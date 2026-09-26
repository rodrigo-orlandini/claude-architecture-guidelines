import { container } from 'tsyringe'
import type { IItemRepository } from './repositories/item-repository'
import { PrismaItemRepository } from './infra/persistence/prisma-item-repository'

// Único lugar do módulo que liga interface (token string) → implementação.
// Classes com @injectable() + @inject() são resolvidas automaticamente;
// use useValue/useFactory só quando a implementação precisa de argumento não injetável.
export function registerExampleModule(): void {
  container.registerSingleton<IItemRepository>('IItemRepository', PrismaItemRepository)
}
