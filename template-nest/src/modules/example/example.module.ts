import { Module } from '@nestjs/common'
import { ItemController } from './infra/http/item.controller'
import { PrismaItemRepository } from './infra/persistence/prisma-item-repository'
import { ITEM_REPOSITORY } from './repositories/item-repository'
import { CreateItemUseCase } from './use-cases/create-item/create-item'
import { GetItemUseCase } from './use-cases/get-item/get-item'
import { ListItemsUseCase } from './use-cases/list-items/list-items'

// The module IS the wiring: it's the only file that binds the port
// (ITEM_REPOSITORY) to its concrete adapter (PrismaItemRepository) — the Nest
// equivalent of the Fastify sibling's container.ts. Nest's own DI container
// resolves everything else (constructor injection) with no manual registration.
@Module({
  controllers: [ItemController],
  providers: [
    { provide: ITEM_REPOSITORY, useClass: PrismaItemRepository },
    CreateItemUseCase,
    GetItemUseCase,
    ListItemsUseCase,
  ],
})
export class ExampleModule {}
