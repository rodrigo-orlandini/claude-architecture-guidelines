import { Injectable, NestMiddleware } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { trace } from '@opentelemetry/api'
import { tracer, otelContext } from './tracer'
import { enterContext } from './context'
import { metrics } from './metrics'

// The Nest-idiomatic equivalent of the Fastify sibling's onRequest/onResponse
// hooks: registered once in AppModule via `consumer.apply(...).forRoutes('*')`
// (see app.module.ts), it runs before every handler. Under Nest's Fastify
// adapter, Express-style middleware like this receives the raw Node req/res
// (via the middie compatibility layer), not the decorated FastifyRequest —
// plain node:http types are the correct and only portable contract here.
//
// Reads x-correlation-id or mints one, seeds the AsyncLocalStorage context,
// opens the root span, and records the request duration metric on the way out.
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: IncomingMessage, res: ServerResponse, next: () => void): void {
    const rawHeader = req.headers['x-correlation-id']
    const correlationId = (Array.isArray(rawHeader) ? rawHeader[0] : rawHeader) ?? randomUUID()
    res.setHeader('x-correlation-id', correlationId)

    enterContext({ correlationId })

    const span = tracer.startSpan('http.request', {
      attributes: {
        'http.method': req.method ?? 'UNKNOWN',
        'http.url': req.url ?? '',
        'correlation.id': correlationId,
      },
    })

    const start = process.hrtime.bigint()
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000
      metrics.httpRequestDuration.observe(
        { method: req.method ?? 'UNKNOWN', route: req.url ?? 'unknown', status_code: String(res.statusCode) },
        durationMs,
      )
      span.setAttribute('http.status_code', res.statusCode)
      span.end()
    })

    otelContext.with(trace.setSpan(otelContext.active(), span), next)
  }
}
