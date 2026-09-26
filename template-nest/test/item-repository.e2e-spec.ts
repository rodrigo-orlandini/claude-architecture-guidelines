// e2e tests hit real infra (here: Postgres via docker-compose.test.yml) — the
// Nest-idiomatic equivalent of the Fastify/Go siblings' `.integration-spec.ts`
// suffix / `//go:build integration` tag: same idea (keep slow, I/O-bound tests
// out of the default `jest` run), Nest's own mechanism (location + suffix,
// run only via `jest --config test/jest-e2e.json`).
import { PrismaService } from '@shared/database/prisma.service'
import { PrismaItemRepository } from '@modules/example/infra/persistence/prisma-item-repository'
import { ItemMapper } from '@modules/example/mappers/item-mapper'

describe('PrismaItemRepository (e2e)', () => {
  const prisma = new PrismaService()
  const repo = new PrismaItemRepository(prisma)

  beforeAll(async () => {
    await prisma.$connect()
  })

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE items CASCADE')
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('saves and finds an item by id', async () => {
    const item = ItemMapper.toDomain({
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Mug',
      status: 'ACTIVE',
      createdAt: new Date(),
    })
    await repo.save(item)

    const found = await repo.findById(item.id)

    expect(found?.name).toBe('Mug')
  })

  it('returns null for an unknown id', async () => {
    expect(await repo.findById('00000000-0000-0000-0000-000000000099')).toBeNull()
  })

  it('lists newest first with total count', async () => {
    await repo.save(
      ItemMapper.toDomain({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Old',
        status: 'ACTIVE',
        createdAt: new Date('2026-01-01'),
      }),
    )
    await repo.save(
      ItemMapper.toDomain({
        id: '00000000-0000-0000-0000-000000000002',
        name: 'New',
        status: 'ACTIVE',
        createdAt: new Date('2026-02-01'),
      }),
    )

    const { items, total } = await repo.findMany({ page: 1, limit: 10 })

    expect(total).toBe(2)
    expect(items.map((item) => item.name)).toEqual(['New', 'Old'])
  })
})
