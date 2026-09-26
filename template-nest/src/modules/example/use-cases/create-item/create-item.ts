import { Inject, Injectable } from '@nestjs/common'
import { type Either, left, right } from '@shared/core/either'
import type { IUseCase } from '@shared/core/use-case'
import { getLogger } from '@shared/observability/logger'
import { addToContext } from '@shared/observability/context'
import { metrics } from '@shared/observability/metrics'
import { tracer, SpanStatusCode } from '@shared/observability/tracer'
import { Item } from '../../entities/item'
import { ItemName, type InvalidItemNameError } from '../../entities/value-objects/item-name'
import { ITEM_REPOSITORY, type IItemRepository } from '../../repositories/item-repository'
import type { CreateItemInput, CreateItemOutput } from '../../dtos/create-item-dto'

// Write pattern: validate VOs (Either) → build entity → persist via port → log/measure.
// Same shape as the Fastify sibling's use-case — only the DI decorators differ
// (@Injectable()/@Inject(TOKEN) instead of @injectable()/@inject('token')).
@Injectable()
export class CreateItemUseCase
  implements IUseCase<CreateItemInput, Either<InvalidItemNameError, CreateItemOutput>>
{
  constructor(
    @Inject(ITEM_REPOSITORY) private readonly itemRepository: IItemRepository,
  ) {}

  async execute(input: CreateItemInput): Promise<Either<InvalidItemNameError, CreateItemOutput>> {
    const span = tracer.startSpan('example.create-item')
    try {
      const nameOrError = ItemName.create(input.name)
      if (nameOrError.isFailure()) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: nameOrError.value.code })
        return left(nameOrError.value)
      }

      const item = Item.create({ name: nameOrError.value })
      await this.itemRepository.save(item)

      addToContext({ itemId: item.id })
      span.setAttribute('item.id', item.id)
      metrics.itemsCreated.inc()
      getLogger().info('item created') // itemId + correlationId come from the context

      return right(item)
    } finally {
      span.end()
    }
  }
}
