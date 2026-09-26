package observability

import "github.com/prometheus/client_golang/prometheus"

// Registry is the process-wide Prometheus registry, exposed at GET /metrics.
var Registry = prometheus.NewRegistry()

// One field per business metric. Convention: <domain>_<event>_total (Counter),
// <domain>_<operation>_duration_ms (Histogram) — same naming convention as
// the TS kit's shared/observability/metrics.ts.
var Metrics = struct {
	HTTPRequestDuration *prometheus.HistogramVec
	ItemsCreated        prometheus.Counter
	ItemsListed         prometheus.Counter
	ItemLookupFailed    *prometheus.CounterVec
}{
	HTTPRequestDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_ms",
		Help:    "HTTP request duration in milliseconds",
		Buckets: []float64{5, 10, 25, 50, 100, 250, 500, 1000, 2500},
	}, []string{"method", "route", "status_code"}),
	ItemsCreated: prometheus.NewCounter(prometheus.CounterOpts{
		Name: "example_items_created_total",
		Help: "Items created via POST /items",
	}),
	ItemsListed: prometheus.NewCounter(prometheus.CounterOpts{
		Name: "example_items_listed_total",
		Help: "Times the item list was requested",
	}),
	ItemLookupFailed: prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "example_item_lookup_failed_total",
		Help: "Item lookups that returned a domain error",
	}, []string{"reason"}),
}

func init() {
	Registry.MustRegister(
		Metrics.HTTPRequestDuration,
		Metrics.ItemsCreated,
		Metrics.ItemsListed,
		Metrics.ItemLookupFailed,
	)
}
