import { Item } from './item'
import { ItemName } from './value-objects/item-name'

function name(raw: string): ItemName {
  const result = ItemName.create(raw)
  if (result.isFailure()) throw result.value
  return result.value
}

describe('Item', () => {
  it('generates an id and starts ACTIVE when nothing else is given', () => {
    const item = Item.create({ name: name('Mug') })
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(item.status).toBe('ACTIVE')
  })

  it('keeps the given id and createdAt', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z')
    const item = Item.create({ name: name('Mug'), createdAt }, 'fixed-id')
    expect(item.id).toBe('fixed-id')
    expect(item.createdAt).toBe(createdAt)
    expect(item.name).toBe('Mug')
  })

  it('archives an active item', () => {
    const item = Item.create({ name: name('Mug') })
    expect(item.archive().isSuccess()).toBe(true)
    expect(item.status).toBe('ARCHIVED')
  })

  it('refuses to archive twice', () => {
    const item = Item.create({ name: name('Mug') })
    item.archive()
    const result = item.archive()
    expect(result.isFailure()).toBe(true)
    if (result.isFailure()) expect(result.value.code).toBe('INVALID_ITEM_STATUS_TRANSITION')
  })
})
