import { describe, it, expect } from 'vitest'
import { runWithContext, getContext, addToContext } from './context'

describe('observability context', () => {
  it('adds business ids without losing correlationId', () => {
    runWithContext({ correlationId: 'c-1' }, () => {
      addToContext({ itemId: 'i-1' })
      expect(getContext()).toEqual({ correlationId: 'c-1', itemId: 'i-1' })
    })
  })

  it('is a no-op outside a context', () => {
    expect(() => addToContext({ itemId: 'i-1' })).not.toThrow()
  })
})
