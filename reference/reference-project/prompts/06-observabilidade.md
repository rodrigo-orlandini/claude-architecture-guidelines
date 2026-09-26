# 06 — Observability

## Goal

Specify and implement production observability in the reference project: structured logs with context propagation, business and infrastructure metrics, distributed tracing linking request → cache → repository → worker, and operational documentation (dashboard, alerts, runbook).

## Context

Feature implemented after asynchronous checkout. Motivation: the system now has flows crossing multiple layers (HTTP → BullMQ → Prisma → mock ERP) and the lack of traceability makes diagnosing production issues difficult.

## Prompt

Implement local observability with the following requirements:

- Structured logs include `correlationId`/`requestId` and `orderId` when it exists
- Relevant metrics, including cache hit/miss and checkout/queue processing
- Real or justified-stub trace/span linking request, cache, repository, and worker
- README includes a dashboard, alert, or runbook example for Datadog or equivalent

## Steering Criteria

- **No vendor lock-in in the core**: OpenTelemetry as the instrumentation layer; configurable exporter (Datadog, Jaeger, console)
- **Local-first**: everything works without external infra — console/noop exporter for dev, configurable via env
- **Business vs. infra metrics**: separate cache metrics (hit rate, latency) from queue metrics (jobs enqueued, confirmed, permanent failures)
- **Context propagation**: the `correlationId` from the HTTP header must flow through to the worker via AsyncLocalStorage or OTel context, without manually passing the value through the whole chain
- **Justified stub**: if real tracing is too complex for the scope, document the span's contract and leave an instrumented no-op

## Result

Full implementation, adopted in its entirety:

- `AsyncLocalStorage` in `src/shared/observability/context.ts` propagates `correlationId`/`orderId` without passing parameters through the call chain
- `getLogger()` in `src/shared/observability/logger.ts` returns `pino.child({...store, traceId, spanId})` called inside span callbacks to capture the active context
- 4 manual OTel spans: `http.request` (onRequest hook with `otelContext.with()` to activate the span), `cache.get`, `checkout.create`, `checkout.process.job`
- 10 prom-client metrics in `src/shared/observability/metrics.ts`: cache hit/miss/eviction/latency, checkout created/confirmed/failed/duration, relay cycles/enqueued
- Provisioned Docker stack: Prometheus, Grafana (port 3001), Loki, Promtail (docker_sd_configs), Tempo (OTLP HTTP 4318)
- Grafana dashboard with 5 panels: Cache Hit Rate, Checkout Funnel, Job Duration, Recent Errors, Instructions

Relevant decision: HTTP→worker traces are separate roots (the relay runs on a `setInterval` with no active HTTP context — W3C traceparent is impossible). Correlation is done via `correlationId`/`orderId` in the span attributes and in the Loki logs.

## Revisions

- Fix wave after final review: `getLogger()` moved inside the span callbacks (captures the correct `traceId`/`spanId`); `onRequest` converted to a done-callback with `otelContext.with()` (child spans connected to the HTTP root); cache histogram fixed to use the `Date.now()` delta (buckets in ms); dashboard PromQL fixed with `sum()` on both sides; Promtail migrated from a static path to `docker_sd_configs`.
