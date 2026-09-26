package httpserver

import (
	"net/http"
	"time"

	"github.com/google/uuid"

	"{{module-path}}/internal/platform/observability"
)

// statusRecorder captures the status code so later middleware (metrics,
// logging) can report it — http.ResponseWriter doesn't expose it otherwise.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

// withCorrelationID reads x-correlation-id or mints one, echoes it back, and
// seeds the request-scoped field map (see observability.WithCorrelationID) —
// equivalent to the onRequest hook in the TS kit's server.ts.
func withCorrelationID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		correlationID := r.Header.Get("x-correlation-id")
		if correlationID == "" {
			correlationID = uuid.NewString()
		}
		w.Header().Set("x-correlation-id", correlationID)

		ctx := observability.WithCorrelationID(r.Context(), correlationID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		observability.FromContext(r.Context()).InfoContext(r.Context(), "incoming request",
			"method", r.Method, "path", r.URL.Path)

		next.ServeHTTP(rec, r)

		observability.FromContext(r.Context()).InfoContext(r.Context(), "request completed",
			"method", r.Method, "path", r.URL.Path, "status", rec.status)
	})
}

func withMetrics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		start := time.Now()

		next.ServeHTTP(rec, r)

		route := r.Pattern
		if route == "" {
			route = "unknown"
		}
		observability.Metrics.HTTPRequestDuration.WithLabelValues(
			r.Method, route, http.StatusText(rec.status),
		).Observe(float64(time.Since(start).Milliseconds()))
	})
}

// withRecover turns a panic in any handler into a 500 instead of crashing the
// process — the Go equivalent of Fastify's built-in crash safety net.
func withRecover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				observability.FromContext(r.Context()).ErrorContext(r.Context(), "panic recovered", "error", rec)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte(`{"statusCode":500,"error":"INTERNAL_ERROR","message":"internal server error"}`))
			}
		}()
		next.ServeHTTP(w, r)
	})
}
