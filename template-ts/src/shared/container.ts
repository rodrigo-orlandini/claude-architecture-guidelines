import { container } from 'tsyringe'
import { prisma } from './database/prisma-client'

// Infra shared across modules. Register single-instance clients here (Prisma, Redis, queues).
export function registerSharedInfra(): void {
  container.register('PrismaClient', { useValue: prisma })
}
