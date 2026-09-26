// Package observability provides structured logging, metrics and tracing —
// the Go counterpart of template/src/shared/observability in the TS kit.
package observability

import "context"

type ctxKey int

const fieldsKey ctxKey = iota

// fields is a mutable map stored by pointer in the context. Go's context.Context
// is otherwise immutable (WithValue returns a new context), so a plain
// map[string]string wouldn't let a later call add a field the same way the TS
// kit's addToContext() mutates its AsyncLocalStorage store in place. Storing a
// *map lets us keep that same additive behavior without threading a new ctx
// through every call site.
type fields map[string]string

// WithCorrelationID seeds a new request-scoped field map. Call once per
// request (in the correlation-id middleware); every AddFields after this
// point on a derived context mutates the same map.
func WithCorrelationID(ctx context.Context, correlationID string) context.Context {
	f := fields{"correlationId": correlationID}
	return context.WithValue(ctx, fieldsKey, &f)
}

// AddFields merges business ids (e.g. "itemId") into the current request's
// field map. No-op outside a request context (e.g. a background job with no
// prior WithCorrelationID) — mirrors addToContext() in the TS kit.
func AddFields(ctx context.Context, kv map[string]string) {
	if f, ok := ctx.Value(fieldsKey).(*fields); ok {
		for k, v := range kv {
			(*f)[k] = v
		}
	}
}

// fieldsFromContext returns a flat copy for the logger to attach as attrs.
func fieldsFromContext(ctx context.Context) map[string]string {
	if f, ok := ctx.Value(fieldsKey).(*fields); ok {
		out := make(map[string]string, len(*f))
		for k, v := range *f {
			out[k] = v
		}
		return out
	}
	return nil
}
