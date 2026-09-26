import 'reflect-metadata'
import { CreateItemUseCase } from './create-item'
import { InMemoryItemRepository } from '../in-memory-item-repository'

describe('CreateItemUseCase', () => {
  let repo: InMemoryItemRepository
  let useCase: CreateItemUseCase

  beforeEach(() => {
    repo = new InMemoryItemRepository()
    useCase = new CreateItemUseCase(repo)
  })

  it('persists a new ACTIVE item with the trimmed name', async () => {
    const result = await useCase.execute({ name: '  Mug  ' })

    expect(result.isSuccess()).toBe(true)
    expect(repo.items).toHaveLength(1)
    expect(repo.items[0].name).toBe('Mug')
    expect(repo.items[0].status).toBe('ACTIVE')
  })

  it('fails with INVALID_ITEM_NAME and persists nothing when the name is blank', async () => {
    const result = await useCase.execute({ name: '   ' })

    expect(result.isFailure()).toBe(true)
    if (result.isFailure()) expect(result.value.code).toBe('INVALID_ITEM_NAME')
    expect(repo.items).toHaveLength(0)
  })
})
