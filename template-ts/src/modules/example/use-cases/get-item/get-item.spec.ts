import 'reflect-metadata'
import { describe, it, expect, beforeEach } from 'vitest'
import { GetItemUseCase } from './get-item'
import { InMemoryItemRepository } from '../in-memory-item-repository'
import { Item } from '../../entities/item'
import { ItemName } from '../../entities/value-objects/item-name'

describe('GetItemUseCase', () => {
  let repo: InMemoryItemRepository
  let useCase: GetItemUseCase

  beforeEach(() => {
    repo = new InMemoryItemRepository()
    useCase = new GetItemUseCase(repo)
  })

  it('returns the item when it exists', async () => {
    const name = ItemName.create('Mug')
    if (name.isFailure()) throw name.value
    await repo.save(Item.create({ name: name.value }, 'item-1'))

    const result = await useCase.execute({ itemId: 'item-1' })

    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) expect(result.value.name).toBe('Mug')
  })

  it('fails with ITEM_NOT_FOUND when the item does not exist', async () => {
    const result = await useCase.execute({ itemId: 'missing' })

    expect(result.isFailure()).toBe(true)
    if (result.isFailure()) expect(result.value.code).toBe('ITEM_NOT_FOUND')
  })
})
