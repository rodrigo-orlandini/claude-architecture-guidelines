import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

// @Global so every feature module can @Inject(PrismaService) without importing
// PrismaModule itself — same reach as the Fastify sibling's single shared client.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
