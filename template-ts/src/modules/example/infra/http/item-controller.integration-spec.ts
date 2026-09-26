import 'reflect-metadata'
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify/types/instance'
import { prisma } from '@shared/database/prisma-client'
import { registerSharedInfra } from '@shared/container'
import { registerExampleModule } from '../../container'
import { buildApp } from '@infra/http/server'

// HTTP routes via app.inject (no port), with real DI and a test Postgres.
describe('ItemController (integration)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    registerSharedInfra()
    registerExampleModule()
    app = await buildApp()
  })

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE items CASCADE')
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  it('POST /items creates an item and returns 201 with correlation header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/items',
      payload: { name: 'Mug' },
      headers: { 'x-correlation-id': 'test-correlation' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.headers['x-correlation-id']).toBe('test-correlation')
    expect(res.json()).toMatchObject({ name: 'Mug', status: 'ACTIVE' })
  })

  it('POST /items rejects unknown fields with 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/items', payload: { name: 'Mug', extra: true } })
    expect(res.statusCode).toBe(400)
  })

  it('POST /items rejects a blank name with 422 INVALID_ITEM_NAME', async () => {
    const res = await app.inject({ method: 'POST', url: '/items', payload: { name: '   ' } })
    expect(res.statusCode).toBe(422)
    expect(res.json().error).toBe('INVALID_ITEM_NAME')
  })

  it('GET /items/:itemId returns the created item, and 404 for an unknown id', async () => {
    const created = await app.inject({ method: 'POST', url: '/items', payload: { name: 'Mug' } })
    const { id } = created.json()

    const found = await app.inject({ method: 'GET', url: `/items/${id}` })
    expect(found.statusCode).toBe(200)
    expect(found.json().id).toBe(id)

    const missing = await app.inject({ method: 'GET', url: '/items/00000000-0000-0000-0000-000000000099' })
    expect(missing.statusCode).toBe(404)
    expect(missing.json().error).toBe('ITEM_NOT_FOUND')
  })

  it('GET /items lists with pagination meta', async () => {
    await app.inject({ method: 'POST', url: '/items', payload: { name: 'A' } })
    await app.inject({ method: 'POST', url: '/items', payload: { name: 'B' } })

    const res = await app.inject({ method: 'GET', url: '/items?limit=1' })

    expect(res.statusCode).toBe(200)
    expect(res.json().meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 })
  })
})
