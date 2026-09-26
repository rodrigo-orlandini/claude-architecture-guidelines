import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

// The Nest-idiomatic equivalent of the Fastify sibling's shared/database/prisma-client.ts:
// a single PrismaClient instance, but wired into Nest's own lifecycle
// (connect on module init, disconnect on shutdown) instead of a bare module-level export.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect()
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
