import { describe, it, expect } from 'vitest'
import { ItemMapper } from './item-mapper'

describe('ItemMapper', () => {
  const row = { id: 'item-1', name: 'Mug', status: 'ACTIVE', createdAt: new Date('2026-01-01T00:00:00Z') }

  it('maps a DB row to the domain and back', () => {
    const item = ItemMapper.toDomain(row)
    expect(item.id).toBe('item-1')
    expect(item.name).toBe('Mug')
    expect(ItemMapper.toPersistence(item)).toEqual(row)
  })

  it('throws on a corrupted row (invalid name)', () => {
    expect(() => ItemMapper.toDomain({ ...row, name: '' })).toThrow('Invalid item name in DB: item-1')
  })

  it('throws on a corrupted row (unknown status)', () => {
    expect(() => ItemMapper.toDomain({ ...row, status: 'DELETED' })).toThrow('Invalid item status in DB: item-1')
  })
})
