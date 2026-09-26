import { type Either, left, right } from '@shared/core/either'
import { DomainError } from '@shared/errors/domain-error'

// A VO's validation error can live in the VO's own file (only the VO produces it).
export class InvalidItemStatusError extends DomainError {
  readonly code = 'INVALID_ITEM_STATUS'
  constructor(raw: string) {
    super(`Invalid item status: ${raw}`)
  }
}

export class InvalidItemStatusTransitionError extends DomainError {
  readonly code = 'INVALID_ITEM_STATUS_TRANSITION'
  constructor(from: string, to: string) {
    super(`Cannot change item status from ${from} to ${to}`)
  }
}

export const ITEM_STATUSES = ['ACTIVE', 'ARCHIVED'] as const
export type ItemStatusValue = (typeof ITEM_STATUSES)[number]

// Allowed transitions: ACTIVE → ARCHIVED. ARCHIVED is terminal.
const TRANSITIONS: Record<ItemStatusValue, readonly ItemStatusValue[]> = {
  ACTIVE: ['ARCHIVED'],
  ARCHIVED: [],
}

export class ItemStatus {
  readonly value: ItemStatusValue

  private constructor(value: ItemStatusValue) {
    this.value = value
  }

  static initial(): ItemStatus {
    return new ItemStatus('ACTIVE')
  }

  // Accepts a raw string (the DB column is String) and validates it against the enum.
  static create(raw: string): Either<InvalidItemStatusError, ItemStatus> {
    if (!(ITEM_STATUSES as readonly string[]).includes(raw)) return left(new InvalidItemStatusError(raw))
    return right(new ItemStatus(raw as ItemStatusValue))
  }

  transitionTo(next: ItemStatusValue): Either<InvalidItemStatusTransitionError, ItemStatus> {
    if (!TRANSITIONS[this.value].includes(next)) {
      return left(new InvalidItemStatusTransitionError(this.value, next))
    }
    return right(new ItemStatus(next))
  }
}
