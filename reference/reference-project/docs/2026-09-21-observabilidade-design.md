# Observability — Design Spec

## Goal

Instrument the reference project with production observability: structured logs with context propagation, business and infrastructure metrics via Prometheus, real distributed tracing linking the HTTP request → use case → cache → BullMQ worker, and a complete local stack (Prometheus + Grafana + Loki + Tempo) with no dependency on an external service.

## Architecture

### Observability layers

```
HTTP Request
  │  onRequest: ALS.run({correlationId}) + tracer.startSpan('http.request')
  ▼
Use Case (CreateCheckout)
  │  tracer.startSpan('checkout.create', {attributes: {order.id, items.count}})
  │  metrics.checkoutCreated.inc()
  ▼
ProductCacheService.getProduct()
  │  tracer.startSpan('cache.get', {attributes: {cache.key, cache.result}})
  │  metrics.cacheHits.inc({layer}) or metrics.cacheMisses.inc()
  ▼
BullMQ Job (separate call stack, context propagated via job.data)
  │  propagation.extract(ROOT_CONTEXT, job.data) → context.with(ctx, ...)
  │  tracer.startSpan('checkout.process.job', {attributes: {order.id, job.id}})
  │  metrics.checkoutConfirmed.inc() or checkoutFailed.inc()
```

### Context propagation

> **Implementation note:** W3C traceparent propagation via the relay was dropped in the final implementation. The relay runs on a `setInterval` with no active HTTP context, making it impossible to link HTTP→worker traces. Traces are separate roots correlated by `correlationId` and `orderId` in logs and spans. See `docs/observability.md` for the current architecture.

Two parallel mechanisms, distinct responsibilities:

**AsyncLocalStorage** (`src/shared/observability/context.ts`):
- Stores `{correlationId: string, orderId?: string}` — business context
- HTTP: `ALS.run()` in the `onRequest` hook
- Worker: `ALS.run()` at the start of job processing
- Relay: `ALS.run()` in the poll loop (no active span)
- `getLogger()` reads the ALS and returns `logger.child(store)` — every log automatically includes `correlationId`/`orderId`

**OTel context** (`@opentelemetry/api`):
- Stores `traceId`/`spanId` — trace context
- Propagated between HTTP and Worker via W3C TraceContext in `job.data`
- Relay injects: `propagation.inject(context.active(), jobData)`
- Worker extracts: `const ctx = propagation.extract(ROOT_CONTEXT, job.data)`
- `getLogger()` also reads `trace.getActiveSpan()` and includes `traceId`/`spanId` in logs

## Tech Stack

| Dependency | Version | Role |
|---|---|---|
| `@opentelemetry/sdk-node` | ^0.52 | Trace SDK + initialization |
| `@opentelemetry/api` | ^1.9 | Span/context API (used across modules) |
| `@opentelemetry/exporter-trace-otlp-http` | ^0.52 | Exports traces to Tempo via OTLP HTTP |
| `@opentelemetry/resources` | ^1.25 | `service.name`, `service.version` |
| `@opentelemetry/semantic-conventions` | ^1.25 | Standardized semantic attributes |
| `prom-client` | ^15 | Prometheus metrics |
| `pino` | ^9 (already present) | Structured logger |

**Local stack (Docker):**
- `grafana/prometheus` — scrapes `/metrics`
- `grafana/grafana` — dashboards, alerts
- `grafana/loki` — log aggregation
- `grafana/promtail` — collects stdout JSON → Loki
- `grafana/tempo` — trace backend, OTLP HTTP on `:4318`

## Files

### Created

| File | Responsibility |
|---|---|
| `src/shared/observability/context.ts` | `AsyncLocalStorage<ObsContext>`; `runWithContext()`; `getContext()` |
| `src/shared/observability/metrics.ts` | `prom-client` Registry; all exported metrics |
| `docker-compose.observability.yml` | Prometheus + Grafana + Loki + Promtail + Tempo stack |
| `prometheus.yml` | Scrape config: `http://host.docker.internal:3000/metrics` every 15s |
| `grafana/provisioning/datasources/prometheus.yml` | Prometheus datasource |
| `grafana/provisioning/datasources/loki.yml` | Loki datasource with `derivedField` traceId → Tempo |
| `grafana/provisioning/datasources/tempo.yml` | Tempo datasource |
| `grafana/provisioning/dashboards/reference-project.json` | Provisioned dashboard |
| `docs/observability.md` | Full runbook |

### Modified

| File | Change |
|---|---|
| `src/shared/observability/tracer.ts` | Real OTel SDK; `NodeSDK` init; `OTLPTraceExporter`; `ConsoleSpanExporter` fallback; exports `tracer = trace.getTracer('reference-project')` |
| `src/shared/observability/logger.ts` | `getLogger()` returns `pino.child({...als.getStore(), traceId, spanId})`; keeps `logger` as the default export for compatibility |
| `src/infra/http/server.ts` | `onRequest`: `runWithContext()` + `startSpan('http.request')`; `onResponse`: `span.end()`; `GET /metrics` route |
| `src/modules/catalog/cache/product-cache-service.ts` | `metrics.cacheHit.inc({layer})` / `metrics.cacheMiss.inc()` at hit/miss points; `tracer.startSpan('cache.get')` |
| `src/modules/checkout/use-cases/create-checkout/create-checkout.ts` | `tracer.startSpan('checkout.create')`; `metrics.checkoutCreated.inc()` |
| `src/modules/checkout/infra/queue/bullmq-checkout-relay.ts` | `propagation.inject(context.active(), jobData)` before enqueueing |
| `src/modules/checkout/infra/queue/bullmq-checkout-worker.ts` | `propagation.extract()` + `context.with()`; `runWithContext({correlationId, orderId})`; `startSpan('checkout.process.job')`; confirmed/failed metrics |
| `src/main.ts` | `initTracer()` before any other import (the SDK must start first) |
| `vitest.coverage.ts` | Exclude `metrics.ts`, `context.ts` from the thresholds |

## Spans

### `http.request`
```typescript
attributes: {
  'http.method': request.method,
  'http.url': request.url,
  'http.status_code': reply.statusCode,  // set in onResponse
  'correlation.id': correlationId,
}
```

### `checkout.create`
```typescript
attributes: {
  'order.id': order.id,
  'customer.id': input.customerId,
  'checkout.items_count': input.items.length,
}
```

### `cache.get`
```typescript
attributes: {
  'cache.key': `product:${id}`,
  'cache.result': 'l1_hit' | 'l2_hit' | 'miss',
  'cache.layer': 'l1' | 'l2',
}
```

### `checkout.process.job`
```typescript
attributes: {
  'order.id': input.orderId,
  'messaging.bullmq.job_id': job.id,
  'messaging.bullmq.attempts': order.attempts,
}
```

## Metrics

### Cache
| Name | Type | Labels |
|---|---|---|
| `cache_hits_total` | Counter | `layer` (l1/l2) |
| `cache_misses_total` | Counter | — |
| `cache_evictions_total` | Counter | — |
| `cache_operation_duration_ms` | Histogram | `operation` (get/set) |

### Checkout
| Name | Type | Labels |
|---|---|---|
| `checkout_orders_created_total` | Counter | — |
| `checkout_orders_confirmed_total` | Counter | — |
| `checkout_orders_failed_total` | Counter | `permanent` (true/false) |
| `checkout_job_duration_ms` | Histogram | — |

### Relay
| Name | Type | Labels |
|---|---|---|
| `checkout_relay_cycles_total` | Counter | — |
| `checkout_relay_enqueued_total` | Counter | — |

## Configuration per environment

| Variable | Dev (no Docker) | Dev (with obs Docker) | Production |
|---|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | not set → ConsoleSpanExporter | `http://localhost:4318` | `http://datadog-agent:4318` |
| `OTEL_SERVICE_NAME` | `reference-project` | `reference-project` | `reference-project` |
| `LOG_LEVEL` | `debug` | `debug` | `info` |

`main.ts` initializes the SDK: if `OTEL_EXPORTER_OTLP_ENDPOINT` is not set, it uses `ConsoleSpanExporter` — the app doesn't crash without Tempo running.

## Grafana Dashboard (provisioned)

Panels included in `reference-project.json`:
1. **Cache Hit Rate** — `rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))` per layer
2. **Checkout Funnel** — created → confirmed → failed (time series)
3. **Job Duration p50/p95/p99** — histogram percentiles
4. **Latest errors** — Loki query `{app="reference-project"} | json | level="error" | line_format "{{.msg}} orderId={{.orderId}}"`
5. **Trace Explorer link** — clickable `traceId` field in logs → opens Tempo

## Example alert

```yaml
# Grafana alert rule
expr: |
  rate(cache_hits_total{layer="l1"}[5m]) /
  (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m])) < 0.70
for: 5m
labels:
  severity: warning
annotations:
  summary: "L1 cache hit rate below 70%"
  description: "Current hit rate: {{ $value | humanizePercentage }}. Check L1 TTL and size."
```

## Runbook (summary)

1. **Checkout stuck (PROCESSING status for >5min):**
   - Grafana Loki: `{app="reference-project"} | json | orderId="<id>"`
   - Copy the `traceId` from the first log → Tempo → see where the span stopped
   - Check BullBoard `/admin/queues` for the job's state

2. **Low cache hit rate:**
   - Check the "Cache Hit Rate" panel — which layer is failing
   - Loki: `{app="reference-project"} | json | msg="cache.miss"` — volume over time
   - Check whether Redis is responding: `redis-cli ping`

3. **Production with Datadog:**
   - Install the Datadog Agent with `otlp_config.receiver.protocols.http.endpoint: 0.0.0.0:4318`
   - Set `OTEL_EXPORTER_OTLP_ENDPOINT=http://datadog-agent:4318`
   - Pino logs (JSON on stdout) collected via Datadog Agent log collection
   - Metrics: configure `openmetrics_check` pointing to the app's `/metrics`
