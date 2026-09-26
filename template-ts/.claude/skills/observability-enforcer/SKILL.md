---
name: observability-enforcer
description: {{PROJECT_NAME}} observability checklist. Run before closing any use-case or controller. Checks correlationId, metrics, spans, and absence of console.log.
---

# Observability Enforcer — {{PROJECT_NAME}}

Checklist run over the indicated file or module. Report only missing items.

## Checklist

### Structured logger
- [ ] `console.log` absent from every analyzed file (exception: fatal bootstrap error in `src/main.ts`)
- [ ] Use-case/infra logs via `getLogger()` from `@shared/observability/logger` (automatically injects `correlationId`, `traceId`, `spanId`)
- [ ] Controller logs via `request.log` with `correlationId: request.correlationId`
- [ ] Relevant business IDs (e.g. `orderId`, `userId`) present in the flow's logs — call `addToContext({ orderId })` from `@shared/observability/context` as soon as the id exists; every subsequent `getLogger()` includes it

### Metrics (`@shared/observability/metrics`)
- [ ] Every relevant business operation has a Counter (`<domain>_<event>_total`)
- [ ] Failures have a Counter with a reason label (`{ reason }` or `{ permanent }`)
- [ ] Operations with relevant latency (I/O, cache, jobs) have a Histogram (`<domain>_<op>_duration_ms`)
- [ ] Cache (if any): hit / miss instrumented

### Tracing (`@shared/observability/tracer`)
- [ ] Root span `http.request` is already created by the server hook — do not duplicate
- [ ] Child span in critical routes/use-cases with business IDs as attributes (`<entity>.id`)
- [ ] Span propagated to external calls (HTTP, queue, adapter)
- [ ] `span.end()` in `finally`; `setStatus({ code: SpanStatusCode.ERROR })` on failure

### Mandatory fields in error logs
- [ ] `error.code` present (DomainError code)
- [ ] `error.message` present
- [ ] `correlationId` present
- [ ] Stack trace NOT exposed to the client (internal log only)

## Output format

```
✅ correlationId propagated
✅ pino logger in use
❌ failure metric missing in create-order.ts
❌ span missing in order-controller.ts
```

Missing items block the task — add them before moving on to arch-reviewer.
