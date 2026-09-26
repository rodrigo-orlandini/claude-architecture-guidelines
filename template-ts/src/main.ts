import 'reflect-metadata'
import { initTracer, shutdownTracer } from '@shared/observability/tracer'
import { logger } from '@shared/observability/logger'
import { registerSharedInfra } from '@shared/container'
import { registerExampleModule } from '@modules/example/container'
import { buildApp } from '@infra/http/server'

async function bootstrap(): Promise<void> {
  initTracer()

  // Ordem: shared infra → módulos (um register<Modulo>Module por módulo) → HTTP → workers
  registerSharedInfra()
  registerExampleModule()

  const app = await buildApp()
  const port = Number(process.env.PORT ?? 3000)
  await app.listen({ port, host: '0.0.0.0' })

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
