import { container } from 'tsyringe'
import { prisma } from './database/prisma-client'

// Infra compartilhada entre módulos. Registre aqui clientes únicos (Prisma, Redis, filas).
export function registerSharedInfra(): void {
  container.register('PrismaClient', { useValue: prisma })
}
