import { describe, it, expect } from 'vitest'
import { ItemStatus } from './item-status'

describe('ItemStatus', () => {
  it('starts as ACTIVE', () => {
    expect(ItemStatus.initial().value).toBe('ACTIVE')
  })

  it('creates from a known raw value', () => {
    const result = ItemStatus.create('ARCHIVED')
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) expect(result.value.value).toBe('ARCHIVED')
  })

  it('rejects an unknown raw value', () => {
    const result = ItemStatus.create('DELETED')
    expect(result.isFailure()).toBe(true)
    if (result.isFailure()) expect(result.value.code).toBe('INVALID_ITEM_STATUS')
  })

  it('allows ACTIVE → ARCHIVED', () => {
    const result = ItemStatus.initial().transitionTo('ARCHIVED')
    expect(result.isSuccess()).toBe(true)
  })

  it('rejects ARCHIVED → ACTIVE (terminal state)', () => {
    const archived = ItemStatus.initial().transitionTo('ARCHIVED')
    if (archived.isFailure()) throw archived.value
    const result = archived.value.transitionTo('ACTIVE')
    expect(result.isFailure()).toBe(true)
    if (result.isFailure()) expect(result.value.code).toBe('INVALID_ITEM_STATUS_TRANSITION')
  })
})
