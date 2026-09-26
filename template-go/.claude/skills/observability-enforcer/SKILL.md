---
name: observability-enforcer
description: Observability checklist for {{PROJECT_NAME}}. Run before closing any use-case or handler. Checks correlationId, metrics, spans, and the absence of unstructured logging.
---

# Observability Enforcer — {{PROJECT_NAME}}

Checklist run against the indicated file or module. Report only missing items.

## Checklist

### Structured logger
- [ ] `fmt.Println` / `log.Println` / `println` absent from every analyzed file (exception: fatal bootstrap error in `cmd/api/main.go`, which doesn't have a logger initialized yet)
- [ ] Logs via `observability.FromContext(ctx)` — never `slog.Default()` directly in a handler or use-case (loses correlationId/traceId)
- [ ] Relevant business IDs (e.g. `orderId`) added with `observability.AddFields(ctx, map[string]string{...})` as soon as they exist — every subsequent `FromContext` in the same request includes them

### Metrics (`internal/platform/observability/metrics.go`)
- [ ] Every relevant business operation has a Counter (`<domain>_<event>_total`)
- [ ] Relevant failures have a Counter with a reason label (`prometheus.CounterVec` with `reason` or similar)
- [ ] Operations with relevant latency have a Histogram (`<domain>_<operation>_duration_ms`)
- [ ] Every new metric is registered in the `Registry` (`init()` block of `metrics.go`) — without this it won't appear in `/metrics`

### Tracing (`internal/platform/observability/tracer.go`)
- [ ] The `http.request`-equivalent root span already comes from the middleware — HTTP handlers don't open their own span for their own route
- [ ] Child span in critical use-cases: `ctx, span := observability.Tracer("<module>").Start(ctx, "<module>.<action>")` with `defer span.End()`
- [ ] Business IDs as span attributes (`span.SetAttributes(...)`) when relevant
- [ ] Span propagated via `ctx` to external calls (HTTP, queue, adapter) — never `context.Background()` created in the middle of a request flow

### Errors
- [ ] `httperr.DomainError.Code` present and mapped in `internal/platform/httperr/error.go`
- [ ] Handler uses `errors.As` to decide the status — never `err.Error()` compared by string
- [ ] Stack trace / internal error NOT exposed to the client (generic message on 500; detail only in the log)

## Output format

```
✅ correlationId propagated
✅ structured logger in use
❌ failure metric missing in create_order.go
❌ span missing in order_handler.go
```

Missing items block the task — add them before moving on to arch-reviewer.
</content>
