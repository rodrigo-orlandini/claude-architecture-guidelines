import { Item } from '../entities/item'
import { ItemName } from '../entities/value-objects/item-name'
import { ItemStatus } from '../entities/value-objects/item-status'

// Formato da linha no banco (espelha o model Prisma sem importar @prisma/client).
// Enums de domínio ficam como coluna String no banco e são validados pelo VO aqui.
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
