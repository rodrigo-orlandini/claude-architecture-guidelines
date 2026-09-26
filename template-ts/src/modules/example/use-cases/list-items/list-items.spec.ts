import 'reflect-metadata'
import { describe, it, expect, beforeEach } from 'vitest'
import { ListItemsUseCase } from './list-items'
import { InMemoryItemRepository } from '../in-memory-item-repository'
import { Item } from '../../entities/item'
import { ItemName } from '../../entities/value-objects/item-name'

function makeItem(id: string, createdAt: Date): Item {
  const name = ItemName.create(`Item ${id}`)
  if (name.isFailure()) throw name.value
  return Item.create({ name: name.value, createdAt }, id)
}

describe('ListItemsUseCase', () => {
  let repo: InMemoryItemRepository
  let useCase: ListItemsUseCase

  beforeEach(() => {
    repo = new InMemoryItemRepository()
    useCase = new ListItemsUseCase(repo)
  })

  it('returns empty page when there are no items', async () => {
    const result = await useCase.execute({})
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) {
      expect(result.value.data).toHaveLength(0)
      expect(result.value.meta).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 })
    }
  })

  it('returns newest items first', async () => {
    repo.items = [
      makeItem('old', new Date('2026-01-01')),
      makeItem('new', new Date('2026-02-01')),
    ]
    const result = await useCase.execute({})
    if (result.isFailure()) throw result.value
    expect(result.value.data.map((item) => item.id)).toEqual(['new', 'old'])
  })

  it('paginates: 25 items, page 3 of limit 10 has 5 items and 3 pages total', async () => {
    repo.items = Array.from({ length: 25 }, (_, i) => makeItem(`id-${i}`, new Date(2026, 0, i + 1)))
    const result = await useCase.execute({ page: 3, limit: 10 })
    if (result.isFailure()) throw result.value
    expect(result.value.data).toHaveLength(5)
    expect(result.value.meta.totalPages).toBe(3)
  })
})
