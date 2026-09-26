import type { Item } from '../entities/item'

export interface GetItemInput {
  itemId: string
}

export type GetItemOutput = Item
