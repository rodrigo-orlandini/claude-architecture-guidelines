package observability

import (
	"context"
	"log/slog"
	"os"

	"go.opentelemetry.io/otel/trace"
)

var base *slog.Logger

// InitLogger sets up the process-wide structured logger (slog + JSON handler).
// Call once from cmd/api/main.go before anything else logs.
func InitLogger(level string) {
	var lvl slog.Level
	if err := lvl.UnmarshalText([]byte(level)); err != nil {
		lvl = slog.LevelInfo
	}
	base = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: lvl}))
	slog.SetDefault(base)
}

// FromContext returns a logger with correlationId, business ids (via
// AddFields) and, if a span is active, traceId/spanId already attached —
// the Go equivalent of getLogger() in the TS kit.
func FromContext(ctx context.Context) *slog.Logger {
	logger := base
	if logger == nil {
		logger = slog.Default()
	}

	fields := fieldsFromContext(ctx)
	args := make([]any, 0, len(fields)*2+4)
	for k, v := range fields {
		args = append(args, k, v)
	}

	if span := trace.SpanContextFromContext(ctx); span.IsValid() {
		args = append(args, "traceId", span.TraceID().String(), "spanId", span.SpanID().String())
	}

	if len(args) == 0 {
		return logger
	}
	return logger.With(args...)
}
