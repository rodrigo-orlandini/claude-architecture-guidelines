import { DomainError } from '@shared/errors/domain-error'

export class ItemNotFoundError extends DomainError {
  readonly code = 'ITEM_NOT_FOUND'

  constructor(itemId: string) {
    super(`Item ${itemId} not found`)
  }
}
