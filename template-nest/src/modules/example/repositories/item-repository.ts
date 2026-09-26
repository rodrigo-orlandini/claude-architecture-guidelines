import type { Item } from '../entities/item'

export interface FindManyParams {
  page: number
  limit: number
}

export interface FindManyResult {
  items: Item[]
  total: number
}

// Port. Implementations: infra/persistence/prisma-item-repository.ts (real),
// use-cases/in-memory-item-repository.ts (test fake).
export interface IItemRepository {
  findMany(params: FindManyParams): Promise<FindManyResult>
  findById(id: string): Promise<Item | null>
  save(item: Item): Promise<void>
}

// Nest's DI resolves providers by token, not by structural interface (interfaces
// don't exist at runtime). This token is what the Fastify sibling's string
// literal 'IItemRepository' becomes here — bind it in example.module.ts
// (`{ provide: ITEM_REPOSITORY, useClass: PrismaItemRepository }`) and consume
// it with `@Inject(ITEM_REPOSITORY)`.
export const ITEM_REPOSITORY = Symbol('IItemRepository')
