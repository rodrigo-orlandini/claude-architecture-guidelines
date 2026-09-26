import type { PaginatedResult } from '@shared/types/pagination'
import type { Item } from '../entities/item'

export interface ListItemsInput {
  page?: number
  limit?: number
}

export type ListItemsOutput = PaginatedResult<Item>
