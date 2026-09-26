import type { Item } from '../entities/item'

export interface CreateItemInput {
  name: string
}

export type CreateItemOutput = Item
