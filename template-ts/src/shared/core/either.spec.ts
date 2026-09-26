import { describe, it, expect } from 'vitest'
import { left, right } from './either'

describe('Either', () => {
  it('left is a failure carrying the value', () => {
    const result = left('boom')
    expect(result.isFailure()).toBe(true)
    expect(result.isSuccess()).toBe(false)
    expect(result.value).toBe('boom')
  })

  it('right is a success carrying the value', () => {
    const result = right(42)
    expect(result.isSuccess()).toBe(true)
    expect(result.isFailure()).toBe(false)
    expect(result.value).toBe(42)
  })
})
