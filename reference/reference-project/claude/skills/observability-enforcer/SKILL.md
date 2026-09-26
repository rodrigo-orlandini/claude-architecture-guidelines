---
name: observability-enforcer
description: Reference project observability checklist. Run before closing any use-case or controller. Checks correlationId, metrics, spans, and the absence of console.log.
---

# Observability Enforcer — Reference Project

Checklist run against the indicated file or module. Report only missing items.

## Checklist

### Structured logger
- [ ] `console.log` absent from every file analyzed
- [ ] Logger (pino) imported from `shared/observability/logger.ts`
- [ ] `correlationId` present in every request log (header `x-correlation-id` or generated)
- [ ] `orderId` present in the logs of any order flow

### Metrics
- [ ] Cache hit instrumented: `metrics.increment('catalog.cache.hit')`
- [ ] Cache miss instrumented: `metrics.increment('catalog.cache.miss')`
- [ ] Checkout initiated instrumented: `metrics.increment('checkout.initiated')`
- [ ] Checkout failure instrumented: `metrics.increment('checkout.failed', { reason })`
- [ ] Response latency recorded via histogram where relevant

### Tracing
- [ ] Span created for `GET /products` (includes hit/miss as an attribute)
- [ ] Span created for `POST /checkout` (includes orderId as an attribute)
- [ ] Span propagated to the call to the ERP adapter

### Required fields in error logs
- [ ] `error.code` present (DomainError code)
- [ ] `error.message` present
- [ ] `correlationId` present
- [ ] Stack trace NOT exposed to the client (internal log only)

## Output format

```
✅ correlationId propagated
✅ pino logger in use
❌ cache hit/miss not instrumented in redis-product-cache.ts
❌ span missing in list-products-controller.ts
```

Missing items block the task — add them before moving on to arch-reviewer.
