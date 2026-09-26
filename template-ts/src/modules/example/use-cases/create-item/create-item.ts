import { injectable, inject } from 'tsyringe'
import { type Either, left, right } from '@shared/core/either'
import type { IUseCase } from '@shared/core/use-case'
import { getLogger } from '@shared/observability/logger'
import { addToContext } from '@shared/observability/context'
import { metrics } from '@shared/observability/metrics'
import { tracer, SpanStatusCode } from '@shared/observability/tracer'
import { Item } from '../../entities/item'
import { ItemName, type InvalidItemNameError } from '../../entities/value-objects/item-name'
import type { IItemRepository } from '../../repositories/item-repository'
import type { CreateItemInput, CreateItemOutput } from '../../dtos/create-item-dto'

// Padrão de escrita: validar VOs (Either) → montar entity → persistir via port → logar/medir.
@injectable()
export class CreateItemUseCase
  implements IUseCase<CreateItemInput, Either<InvalidItemNameError, CreateItemOutput>>
{
  constructor(
    @inject('IItemRepository') private readonly itemRepository: IItemRepository,
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
      getLogger().info('item created') // itemId + correlationId vêm do contexto

      return right(item)
    } finally {
      span.end()
    }
  }
}
