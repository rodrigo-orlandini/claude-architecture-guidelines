import type { Item } from '../entities/item'
import type { ListItemsOutput } from '../dtos/list-items-dto'
import type { PaginatedResult } from '@shared/types/pagination'

export interface ItemHttp {
  id: string
  name: string
  status: string
  createdAt: string
}

// Domain → HTTP contract. The only place that decides the response format.
export class ItemPresenter {
  static toHTTP(item: Item): ItemHttp {
    return { id: item.id, name: item.name, status: item.status, createdAt: item.createdAt.toISOString() }
  }

  static toHTTPList(output: ListItemsOutput): PaginatedResult<ItemHttp> {
    return { data: output.data.map(ItemPresenter.toHTTP), meta: output.meta }
  }
}
