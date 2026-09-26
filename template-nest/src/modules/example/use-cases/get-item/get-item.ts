import { Inject, Injectable } from '@nestjs/common'
import { type Either, left, right } from '@shared/core/either'
import type { IUseCase } from '@shared/core/use-case'
import { getLogger } from '@shared/observability/logger'
import { metrics } from '@shared/observability/metrics'
import { tracer } from '@shared/observability/tracer'
import { ITEM_REPOSITORY, type IItemRepository } from '../../repositories/item-repository'
import { ItemNotFoundError } from '../../errors/item-not-found-error'
import type { GetItemInput, GetItemOutput } from '../../dtos/get-item-dto'

@Injectable()
export class GetItemUseCase
  implements IUseCase<GetItemInput, Either<ItemNotFoundError, GetItemOutput>>
{
  constructor(
    @Inject(ITEM_REPOSITORY) private readonly itemRepository: IItemRepository,
  ) {}

  async execute({ itemId }: GetItemInput): Promise<Either<ItemNotFoundError, GetItemOutput>> {
    const span = tracer.startSpan('example.get-item', { attributes: { 'item.id': itemId } })
    try {
      const item = await this.itemRepository.findById(itemId)

      if (!item) {
        const error = new ItemNotFoundError(itemId)
        metrics.itemLookupFailed.inc({ reason: error.code })
        getLogger().warn({ itemId, error: { code: error.code, message: error.message } }, 'item not found')
        return left(error)
      }

      return right(item)
    } finally {
      span.end()
    }
  }
}
