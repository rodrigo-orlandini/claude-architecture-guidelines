import { ItemName } from './item-name'

describe('ItemName', () => {
  it('creates with a valid name and trims whitespace', () => {
    const result = ItemName.create('  Blue mug  ')
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) expect(result.value.value).toBe('Blue mug')
  })

  it('rejects empty string', () => {
    const result = ItemName.create('')
    expect(result.isFailure()).toBe(true)
    if (result.isFailure()) expect(result.value.code).toBe('INVALID_ITEM_NAME')
  })

  it('rejects whitespace-only string', () => {
    expect(ItemName.create('   ').isFailure()).toBe(true)
  })

  it('accepts exactly 120 characters', () => {
    expect(ItemName.create('a'.repeat(120)).isSuccess()).toBe(true)
  })

  it('rejects 121 characters', () => {
    expect(ItemName.create('a'.repeat(121)).isFailure()).toBe(true)
  })
})
