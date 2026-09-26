import { type Either, left, right } from '@shared/core/either'
import { DomainError } from '@shared/errors/domain-error'

// Erro de validação do VO pode ficar no próprio arquivo do VO (só o VO o produz).
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

// Transições permitidas: ACTIVE → ARCHIVED. ARCHIVED é terminal.
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

  // Aceita string crua (banco é coluna String) e valida contra o enum.
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
