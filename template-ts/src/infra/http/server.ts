import * as FastifyModule from 'fastify'
import type { FastifyInstance } from 'fastify/types/instance'
import type { FastifyRequest, FastifyReply } from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { randomUUID } from 'node:crypto'
import { container } from 'tsyringe'
import { trace } from '@opentelemetry/api'
import { tracer, SpanStatusCode, otelContext } from '@shared/observability/tracer'
import { enterContext } from '@shared/observability/context'
import { register, metrics } from '@shared/observability/metrics'
import { ItemController } from '@modules/example/infra/http/item-controller'

export async function buildApp(): Promise<FastifyInstance> {
  const app = FastifyModule.fastify({
    genReqId: () => randomUUID(),
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    // Fastify 4 uses removeAdditional: true by default — an extra field would be silently discarded.
    // Turned off so that `additionalProperties: false` responds with 400.
    ajv: { customOptions: { removeAdditional: false } },
  })

  await app.register(swagger, {
    openapi: {
      info: {
        title: '{{PROJECT_NAME}} API',
        version: '1.0.0',
      },
      tags: [{ name: 'Items', description: 'Example module' }],
    },
  })

  await app.register(swaggerUi, { routePrefix: '/docs' })

  // correlationId + ALS context + root span per request
  app.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
    const correlationId =
      (request.headers['x-correlation-id'] as string | undefined) ?? request.id
    request.correlationId = correlationId
    void reply.header('x-correlation-id', correlationId)

    enterContext({ correlationId })

    const span = tracer.startSpan('http.request', {
      attributes: {
        'http.method': request.method,
        'http.url': request.url,
        'correlation.id': correlationId,
      },
    })
    request.span = span

    request.log.info({ correlationId, method: request.method, url: request.url }, 'incoming request')

    otelContext.with(trace.setSpan(otelContext.active(), span), done)
  })

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    metrics.httpRequestDuration.observe(
      {
        method: request.method,
        route: request.routeOptions?.url ?? 'unknown',
        status_code: String(reply.statusCode),
      },
      reply.elapsedTime,
    )
    request.span?.setAttribute('http.status_code', reply.statusCode)
    if (reply.statusCode >= 500) {
      request.span?.setStatus({ code: SpanStatusCode.ERROR })
    }
    request.span?.end()
  })

  app.get('/health', async () => ({ status: 'ok' }))

  app.get('/metrics', async (_request, reply) => {
    reply.header('content-type', register.contentType)
    return register.metrics()
  })

  // One controller per resource; each registers its own routes.
  await container.resolve(ItemController).registerRoutes(app)

  return app
}
