import { Inject, Injectable } from '@nestjs/common'
import { type Either, right } from '@shared/core/either'
import type { IUseCase } from '@shared/core/use-case'
import type { DomainError } from '@shared/errors/domain-error'
import { metrics } from '@shared/observability/metrics'
import { ITEM_REPOSITORY, type IItemRepository } from '../../repositories/item-repository'
import type { ListItemsInput, ListItemsOutput } from '../../dtos/list-items-dto'

@Injectable()
export class ListItemsUseCase
  implements IUseCase<ListItemsInput, Either<DomainError, ListItemsOutput>>
{
  constructor(
    @Inject(ITEM_REPOSITORY) private readonly itemRepository: IItemRepository,
  ) {}

  async execute(input: ListItemsInput): Promise<Either<DomainError, ListItemsOutput>> {
    const page = input.page ?? 1
    const limit = input.limit ?? 20
    const { items, total } = await this.itemRepository.findMany({ page, limit })

    metrics.itemsListed.inc()

    return right({
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  }
}
