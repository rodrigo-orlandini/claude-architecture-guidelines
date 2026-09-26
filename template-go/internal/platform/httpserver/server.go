// Package httpserver builds the process's single http.Server: a plain
// net/http.ServeMux (Go 1.22+ method+wildcard routing — the "native router"
// equivalent of the TS kit's Fastify instance), wrapped in a small middleware
// chain. Each module registers its own routes on the mux; this package owns
// only cross-cutting concerns (correlation id, logging, recovery, metrics).
package httpserver

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"{{module-path}}/internal/platform/observability"
)

// RouteRegistrar is implemented by each module's adapters/httpapi package.
type RouteRegistrar interface {
	RegisterRoutes(mux *http.ServeMux)
}

func New(registrars ...RouteRegistrar) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	mux.Handle("GET /metrics", promhttp.HandlerFor(observability.Registry, promhttp.HandlerOpts{}))

	for _, reg := range registrars {
		reg.RegisterRoutes(mux)
	}

	// Order matters, for a reason sharper than "outermost runs first":
	// withCorrelationID calls r.WithContext(ctx), which returns a *shallow
	// copy* of the request (net/http's documented behavior). Any middleware
	// wrapping it from the outside would keep the pre-copy pointer and never
	// see the correlationId in its own context, nor the r.Pattern that
	// ServeMux later sets on the copy it actually dispatches to. So
	// withCorrelationID must be outermost: everyone else — recover, metrics,
	// logging, the handlers — then shares that same (copied) request.
	return withCorrelationID(withRecover(withMetrics(withLogging(mux))))
}
