import { container } from 'tsyringe'
import type { IItemRepository } from './repositories/item-repository'
import { PrismaItemRepository } from './infra/persistence/prisma-item-repository'

// The only place in the module that wires an interface (string token) → implementation.
// Classes with @injectable() + @inject() are resolved automatically;
// use useValue/useFactory only when the implementation needs a non-injectable argument.
export function registerExampleModule(): void {
  container.registerSingleton<IItemRepository>('IItemRepository', PrismaItemRepository)
}
