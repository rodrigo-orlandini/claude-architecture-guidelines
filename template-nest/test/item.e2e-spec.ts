import { Test } from '@nestjs/testing'
import { ValidationPipe } from '@nestjs/common'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '@shared/database/prisma.service'
import { validationExceptionFactory } from '@shared/errors/validation-exception-factory'

// Full-stack e2e: real Nest DI container, real Postgres, real HTTP over
// Fastify — the Nest-idiomatic equivalent of the Fastify sibling's
// item-controller.integration-spec.ts (app.inject) and the Go sibling's
// item_handler_integration_test.go (httptest.NewServer). Learned from a real
// bug found while building the Fastify sibling: always test the "unknown
// field in the body" case explicitly, don't assume the framework's default
// validation rejects it — here Nest's ValidationPipe(forbidNonWhitelisted)
// does, and this test is what proves it.
describe('Items (e2e)', () => {
  let app: NestFastifyApplication
  let prisma: PrismaService

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter())
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: validationExceptionFactory,
      }),
    )
    await app.init()
    await app.getHttpAdapter().getInstance().ready()

    prisma = moduleRef.get(PrismaService)
  })

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE items CASCADE')
  })

  afterAll(async () => {
    await app.close()
  })

  it('POST /items creates an item and returns 201 with a correlation header', async () => {
    const res = await request(app.getHttpServer())
      .post('/items')
      .send({ name: 'Mug' })
      .set('x-correlation-id', 'test-correlation')
      .expect(201)

    expect(res.headers['x-correlation-id']).toBe('test-correlation')
    expect(res.body).toMatchObject({ name: 'Mug', status: 'ACTIVE' })
  })

  it('POST /items rejects an unknown field with 400 in the shared error shape', async () => {
    const res = await request(app.getHttpServer())
      .post('/items')
      .send({ name: 'Mug', hacker: true })
      .expect(400)
    // Same {statusCode, error, message} shape as every domain-error response —
    // not Nest's default {message, error: 'Bad Request', statusCode}.
    expect(res.body).toMatchObject({ statusCode: 400, error: 'INVALID_REQUEST_BODY' })
  })

  it('POST /items rejects a blank name with 422 INVALID_ITEM_NAME', async () => {
    const res = await request(app.getHttpServer()).post('/items').send({ name: '   ' }).expect(422)
    expect(res.body.error).toBe('INVALID_ITEM_NAME')
  })

  it('GET /items/:itemId returns the created item, and 404 for an unknown id', async () => {
    const created = await request(app.getHttpServer()).post('/items').send({ name: 'Mug' })

    const found = await request(app.getHttpServer()).get(`/items/${created.body.id}`).expect(200)
    expect(found.body.id).toBe(created.body.id)

    const missing = await request(app.getHttpServer())
      .get('/items/00000000-0000-0000-0000-000000000099')
      .expect(404)
    expect(missing.body.error).toBe('ITEM_NOT_FOUND')
  })

  it('GET /items lists with pagination meta', async () => {
    await request(app.getHttpServer()).post('/items').send({ name: 'A' })
    await request(app.getHttpServer()).post('/items').send({ name: 'B' })

    const res = await request(app.getHttpServer()).get('/items?limit=1').expect(200)

    expect(res.body.meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 })
  })
})
