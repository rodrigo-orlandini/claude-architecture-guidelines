import type { Item } from '../entities/item'
import type { IItemRepository, FindManyParams, FindManyResult } from '../repositories/item-repository'

// A fake shared by more than one use-case lives in use-cases/; if used by only one, co-locate it in its folder.
export class InMemoryItemRepository implements IItemRepository {
  items: Item[] = []

  async findMany({ page, limit }: FindManyParams): Promise<FindManyResult> {
    const sorted = [...this.items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    const skip = (page - 1) * limit
    return { items: sorted.slice(skip, skip + limit), total: this.items.length }
  }

  async findById(id: string): Promise<Item | null> {
    return this.items.find((item) => item.id === id) ?? null
  }

  async save(item: Item): Promise<void> {
    this.items = [...this.items.filter((existing) => existing.id !== item.id), item]
  }
}
