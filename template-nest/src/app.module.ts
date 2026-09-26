import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { PrismaModule } from '@shared/database/prisma.module'
import { CorrelationIdMiddleware } from '@shared/observability/correlation-id.middleware'
import { ExampleModule } from '@modules/example/example.module'

// Register one feature module per bounded context here — same slot as
// registerCatalogModule/registerCheckoutModule in the Fastify sibling's main.ts,
// just as an `imports:` entry instead of a function call.
@Module({
  imports: [PrismaModule, ExampleModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*')
  }
}
