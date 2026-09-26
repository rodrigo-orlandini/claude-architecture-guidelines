import { Item } from '../entities/item'
import { ItemName } from '../entities/value-objects/item-name'
import { ItemStatus } from '../entities/value-objects/item-status'

// Shape of the database row (mirrors the Prisma model without importing @prisma/client).
// Domain enums are kept as a String column in the database and are validated by the VO here.
export interface ItemRow {
  id: string
  name: string
  status: string
  createdAt: Date
}

export class ItemMapper {
  static toDomain(row: ItemRow): Item {
    const nameOrError = ItemName.create(row.name)
    if (nameOrError.isFailure()) throw new Error(`Invalid item name in DB: ${row.id}`)
    const statusOrError = ItemStatus.create(row.status)
    if (statusOrError.isFailure()) throw new Error(`Invalid item status in DB: ${row.id}`)
    return Item.create(
      { name: nameOrError.value, status: statusOrError.value, createdAt: row.createdAt },
      row.id,
    )
  }

  static toPersistence(item: Item): ItemRow {
    return { id: item.id, name: item.name, status: item.status, createdAt: item.createdAt }
  }
}
