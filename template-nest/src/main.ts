import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { validationExceptionFactory } from '@shared/errors/validation-exception-factory'
import { initTracer, shutdownTracer } from '@shared/observability/tracer'
import { logger } from '@shared/observability/logger'
import { register as metricsRegistry } from '@shared/observability/metrics'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  initTracer()

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false, // pino (shared/observability/logger) replaces Nest's built-in logger everywhere
  })

  // whitelist + forbidNonWhitelisted: an unknown body field is rejected with
  // 400 — the Nest-idiomatic equivalent of the Fastify sibling's
  // `additionalProperties: false` / Go's DisallowUnknownFields.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  )

  const swaggerConfig = new DocumentBuilder()
    .setTitle('{{PROJECT_NAME}} API')
    .setVersion('1.0.0')
    .build()
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig))

  const fastify = app.getHttpAdapter().getInstance()
  fastify.get('/health', async () => ({ status: 'ok' }))
  fastify.get('/metrics', async (_request, reply) => {
    reply.header('content-type', metricsRegistry.contentType)
    return metricsRegistry.metrics()
  })

  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port, '0.0.0.0')
  logger.info({ port }, 'server listening')

  const shutdown = async (): Promise<void> => {
    logger.info('shutting down')
    await app.close()
    await shutdownTracer()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
