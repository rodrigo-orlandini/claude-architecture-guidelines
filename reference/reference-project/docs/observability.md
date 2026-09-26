# Observability — Reference Project

## Local stack

```bash
wsl docker compose -f docker-compose.observability.yml up -d
```

Services:
| Service | URL | Role |
|---|---|---|
| Grafana | http://localhost:3001 | Dashboards, logs, traces |
| Prometheus | http://localhost:9090 | Scrapes /metrics |
| Loki | http://localhost:3100 | Log aggregation |
| Tempo | http://localhost:3200 | Trace backend |
| App | http://localhost:3000 | API + /metrics |

Environment variables to enable trace export:
```bash
# When the app runs locally (outside Docker):
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# When the app runs in Docker (same host as the observability stack):
OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318

OTEL_SERVICE_NAME=reference-project
```

Without these variables, the app uses `ConsoleSpanExporter` — spans appear on stdout.

## Instrumented spans

| Span | Where | Key attributes |
|---|---|---|
| `http.request` | Fastify onRequest/onResponse | `http.method`, `http.url`, `correlation.id`, `http.status_code` |
| `cache.get` | ProductCacheService.getProduct | `cache.key`, `cache.result` (l1_hit/l2_hit/miss) |
| `checkout.create` | CreateCheckoutUseCase.execute | `order.id`, `customer.id`, `checkout.items_count` |
| `checkout.process.job` | BullMQCheckoutWorker | `order.id`, `messaging.bullmq.job_id`, `messaging.bullmq.attempts` |

**Architecture note:** `http.request` and `checkout.process.job` are separate traces because the Outbox Pattern breaks the synchronous chain — the relay polls on a `setInterval` with no active HTTP context. Correlation between them is done via `correlationId` in the logs (Loki) and the `order.id` attribute on spans (Tempo).

## Metrics available at /metrics

| Metric | Type | Description |
|---|---|---|
| `cache_hits_total{layer}` | Counter | Hits per layer (l1/l2) |
| `cache_misses_total` | Counter | Cache misses |
| `cache_evictions_total` | Counter | L1 LFU evictions |
| `cache_operation_duration_ms` | Histogram | Cache operation latency |
| `checkout_orders_created_total` | Counter | Orders created |
| `checkout_orders_confirmed_total` | Counter | Orders confirmed |
| `checkout_orders_failed_total{permanent}` | Counter | Orders that failed |
| `checkout_job_duration_ms` | Histogram | Job processing duration |
| `checkout_relay_cycles_total` | Counter | Relay poll cycles |
| `checkout_relay_enqueued_total` | Counter | Entries enqueued by the relay |

## Example alerts (Grafana)

```yaml
# Cache hit rate below 70% for 5 minutes
expr: |
  sum(rate(cache_hits_total[5m])) / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m]))) < 0.70
for: 5m
labels:
  severity: warning
annotations:
  summary: "L1+L2 cache hit rate below 70%"

# Checkout failures above 10% for 10 minutes
expr: |
  rate(checkout_orders_failed_total{permanent="true"}[10m]) /
  rate(checkout_orders_created_total[10m]) > 0.10
for: 10m
labels:
  severity: critical
annotations:
  summary: "Permanent checkout failure rate above 10%"
```

## Runbook — Checkout stuck

Symptom: order with `PROCESSING` status for more than 5 minutes.

1. **Loki** → Explore → query: `{app="reference-project"} | json | orderId="<id>"`
   - View the sequence of events for the orderId
   - Copy the `traceId` from the `checkout.job.start` log

2. **Tempo** → Explore → search by `traceId`
   - View the `checkout.process.job` span — where it stopped or what error occurred

3. **BullBoard** → http://localhost:3000/admin/queues
   - Check the job's state in `checkout-processing`
   - Jobs in `failed`: check the error and attempt count

4. **Prometheus** → query: `checkout_orders_failed_total`
   - Check whether it's an isolated or systemic failure

## Production with Datadog

Replace `OTEL_EXPORTER_OTLP_ENDPOINT` with the Datadog Agent endpoint with OTLP enabled:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://datadog-agent:4318
```

The Datadog Agent receives traces via OTLP. For metrics, configure `openmetrics_check` pointing to `http://app:3000/metrics`. For logs, collect stdout JSON via Datadog Log Collection.
