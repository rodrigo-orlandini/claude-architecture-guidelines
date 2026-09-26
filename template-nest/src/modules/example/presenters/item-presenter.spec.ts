import { ItemPresenter } from './item-presenter'
import { ItemMapper } from '../mappers/item-mapper'

describe('ItemPresenter', () => {
  const item = ItemMapper.toDomain({
    id: 'item-1',
    name: 'Mug',
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  })

  it('serializes createdAt as ISO string', () => {
    expect(ItemPresenter.toHTTP(item)).toEqual({
      id: 'item-1',
      name: 'Mug',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('keeps pagination meta untouched', () => {
    const meta = { page: 1, limit: 20, total: 1, totalPages: 1 }
    const result = ItemPresenter.toHTTPList({ data: [item], meta })
    expect(result.meta).toBe(meta)
    expect(result.data).toHaveLength(1)
  })
})
