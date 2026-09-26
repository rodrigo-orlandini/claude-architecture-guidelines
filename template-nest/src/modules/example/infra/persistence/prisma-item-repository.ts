import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/database/prisma.service'
import type { Item } from '../../entities/item'
import type { IItemRepository, FindManyParams, FindManyResult } from '../../repositories/item-repository'
import { ItemMapper } from '../../mappers/item-mapper'

// Implements the port. Bound to ITEM_REPOSITORY in example.module.ts — nothing
// above this file (use-cases, controller) imports it or PrismaService directly.
@Injectable()
export class PrismaItemRepository implements IItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany({ page, limit }: FindManyParams): Promise<FindManyResult> {
    const [rows, total] = await Promise.all([
      this.prisma.item.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.item.count(),
    ])
    return { items: rows.map(ItemMapper.toDomain), total }
  }

  async findById(id: string): Promise<Item | null> {
    const row = await this.prisma.item.findUnique({ where: { id } })
    return row ? ItemMapper.toDomain(row) : null
  }

  async save(item: Item): Promise<void> {
    const data = ItemMapper.toPersistence(item)
    await this.prisma.item.upsert({ where: { id: data.id }, create: data, update: { name: data.name, status: data.status } })
  }
}
