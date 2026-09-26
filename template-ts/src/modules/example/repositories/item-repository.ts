import type { Item } from '../entities/item'

export interface FindManyParams {
  page: number
  limit: number
}

export interface FindManyResult {
  items: Item[]
  total: number
}

// Port. Implementações: infra/persistence/prisma-item-repository.ts (real),
// use-cases/in-memory-item-repository.ts (fake de teste).
export interface IItemRepository {
  findMany(params: FindManyParams): Promise<FindManyResult>
  findById(id: string): Promise<Item | null>
  save(item: Item): Promise<void>
}
