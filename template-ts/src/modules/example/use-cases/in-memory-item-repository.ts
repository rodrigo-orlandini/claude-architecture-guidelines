import type { Item } from '../entities/item'
import type { IItemRepository, FindManyParams, FindManyResult } from '../repositories/item-repository'

// Fake compartilhado por mais de um use-case fica em use-cases/; se usado por um só, co-locar na pasta dele.
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
