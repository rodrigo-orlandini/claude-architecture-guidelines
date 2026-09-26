import { randomUUID } from 'node:crypto'
import { type Either, left, right } from '@shared/core/either'
import type { ItemName } from './value-objects/item-name'
import { ItemStatus, type InvalidItemStatusTransitionError } from './value-objects/item-status'

interface ItemProps {
  name: ItemName
  status: ItemStatus
  createdAt: Date
}

export class Item {
  readonly id: string
  private props: ItemProps

  private constructor(props: ItemProps, id: string) {
    this.props = props
    this.id = id
  }

  // VOs arrive already validated; the entity only holds structural invariants.
  static create(
    props: { name: ItemName; status?: ItemStatus; createdAt?: Date },
    id?: string,
  ): Item {
    return new Item(
      {
        name: props.name,
        status: props.status ?? ItemStatus.initial(),
        createdAt: props.createdAt ?? new Date(),
      },
      id ?? randomUUID(),
    )
  }

  get name(): string { return this.props.name.value }
  get status(): string { return this.props.status.value }
  get createdAt(): Date { return this.props.createdAt }

  // Domain behavior delegates the transition rule to the VO.
  archive(): Either<InvalidItemStatusTransitionError, Item> {
    const next = this.props.status.transitionTo('ARCHIVED')
    if (next.isFailure()) return left(next.value)
    this.props = { ...this.props, status: next.value }
    return right(this)
  }
}
