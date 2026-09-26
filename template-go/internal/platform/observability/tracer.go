package observability

import (
	"context"
	"os"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
)

var tracerProvider *sdktrace.TracerProvider

// InitTracer wires OpenTelemetry. Without OTEL_EXPORTER_OTLP_ENDPOINT, spans
// print to stdout (stdouttrace), the Go equivalent of the TS kit's
// ConsoleSpanExporter fallback.
func InitTracer(ctx context.Context, serviceName string) (func(context.Context) error, error) {
	var exporter sdktrace.SpanExporter
	var err error

	if endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"); endpoint != "" {
		exporter, err = otlptracehttp.New(ctx, otlptracehttp.WithEndpointURL(endpoint+"/v1/traces"))
	} else {
		exporter, err = stdouttrace.New(stdouttrace.WithPrettyPrint())
	}
	if err != nil {
		return nil, err
	}

	res, err := resource.New(ctx, resource.WithAttributes(
		semconv.ServiceName(serviceName),
		semconv.ServiceVersion("1.0.0"),
	))
	if err != nil {
		return nil, err
	}

	tracerProvider = sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tracerProvider)

	return tracerProvider.Shutdown, nil
}

// Tracer returns the named tracer used across the example module. Call sites
// use it the same way the TS kit imports `tracer` from shared/observability/tracer.
func Tracer(name string) trace.Tracer {
	return otel.Tracer(name)
}
