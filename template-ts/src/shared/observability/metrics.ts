import { Counter, Histogram, Registry } from 'prom-client'

export const register = new Registry()
register.setDefaultLabels({ service: '{{project-slug}}' })

// Uma entrada por métrica de negócio. Convenção: <dominio>_<evento>_total (Counter),
// <dominio>_<operacao>_duration_ms (Histogram). Exposto em GET /metrics.
export const metrics = {
  httpRequestDuration: new Histogram({
    name: 'http_request_duration_ms',
    help: 'HTTP request duration in milliseconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500],
    registers: [register],
  }),
  itemsCreated: new Counter({
    name: 'example_items_created_total',
    help: 'Items created via POST /items',
    registers: [register],
  }),
  itemsListed: new Counter({
    name: 'example_items_listed_total',
    help: 'Times the item list was requested',
    registers: [register],
  }),
  itemLookupFailed: new Counter({
    name: 'example_item_lookup_failed_total',
    help: 'Item lookups that returned a domain error',
    labelNames: ['reason'] as const,
    registers: [register],
  }),
}
