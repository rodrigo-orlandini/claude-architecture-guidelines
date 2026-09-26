import { type Either, left, right } from '@shared/core/either'
import { DomainError } from '@shared/errors/domain-error'

export class InvalidItemNameError extends DomainError {
  readonly code = 'INVALID_ITEM_NAME'
  constructor() {
    super('Item name must be non-empty and at most 120 characters')
  }
}

export class ItemName {
  static readonly MAX_LENGTH = 120

  readonly value: string

  private constructor(value: string) {
    this.value = value
  }

  static create(raw: string): Either<InvalidItemNameError, ItemName> {
    const trimmed = raw.trim()
    if (trimmed.length === 0 || trimmed.length > ItemName.MAX_LENGTH) {
      return left(new InvalidItemNameError())
    }
    return right(new ItemName(trimmed))
  }
}
