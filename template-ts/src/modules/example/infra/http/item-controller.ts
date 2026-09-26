import { injectable, inject } from 'tsyringe'
import type { FastifyInstance } from 'fastify/types/instance'
import { ListItemsUseCase } from '../../use-cases/list-items/list-items'
import { GetItemUseCase } from '../../use-cases/get-item/get-item'
import { CreateItemUseCase } from '../../use-cases/create-item/create-item'
import { ItemPresenter } from '../../presenters/item-presenter'
import { toHttpError } from '@shared/errors/http-error-mapper'

interface ListItemsQuery {
  page?: number
  limit?: number
}

interface GetItemParams {
  itemId: string
}

interface CreateItemBody {
  name: string
}

const errorSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'integer' },
    error: { type: 'string' },
    message: { type: 'string' },
  },
}

const itemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    status: { type: 'string', enum: ['ACTIVE', 'ARCHIVED'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'name', 'status', 'createdAt'],
}

// Controller: valida entrada via schema, chama use-case, faz match no Either. Sem regra de negócio.
@injectable()
export class ItemController {
  constructor(
    @inject(ListItemsUseCase) private readonly listItems: ListItemsUseCase,
    @inject(GetItemUseCase) private readonly getItem: GetItemUseCase,
    @inject(CreateItemUseCase) private readonly createItem: CreateItemUseCase,
  ) {}

  async registerRoutes(app: FastifyInstance): Promise<void> {
    // Escrita: schema valida forma (tipos, obrigatórios, sem campos extras → 400);
    // regra de negócio fica no use-case (Either → 422/409 via http-error-mapper).
    app.post<{ Body: CreateItemBody }>(
      '/items',
      {
        schema: {
          tags: ['Items'],
          summary: 'Criar item',
          body: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
            additionalProperties: false,
          },
          response: { 201: itemSchema, 400: errorSchema, 422: errorSchema },
        },
      },
      async (request, reply) => {
        const result = await this.createItem.execute({ name: request.body.name })

        if (result.isFailure()) {
          const err = toHttpError(result.value)
          request.log.warn({ correlationId: request.correlationId, error: err }, 'create-item failed')
          return reply.status(err.statusCode).send(err)
        }

        return reply.status(201).send(ItemPresenter.toHTTP(result.value))
      },
    )

    app.get<{ Querystring: ListItemsQuery }>(
      '/items',
      {
        schema: {
          tags: ['Items'],
          summary: 'Listar itens',
          querystring: {
            type: 'object',
            properties: {
              page: { type: 'integer', minimum: 1, default: 1 },
              limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                data: { type: 'array', items: itemSchema },
                meta: {
                  type: 'object',
                  properties: {
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                    total: { type: 'integer' },
                    totalPages: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
      async (request, reply) => {
        const result = await this.listItems.execute(request.query)

        if (result.isFailure()) {
          const err = toHttpError(result.value)
          request.log.error({ correlationId: request.correlationId, error: err }, 'list-items failed')
          return reply.status(err.statusCode).send(err)
        }

        return reply.send(ItemPresenter.toHTTPList(result.value))
      },
    )

    app.get<{ Params: GetItemParams }>(
      '/items/:itemId',
      {
        schema: {
          tags: ['Items'],
          summary: 'Buscar item por id',
          params: {
            type: 'object',
            properties: { itemId: { type: 'string' } },
            required: ['itemId'],
          },
          response: { 200: itemSchema, 404: errorSchema },
        },
      },
      async (request, reply) => {
        const result = await this.getItem.execute({ itemId: request.params.itemId })

        if (result.isFailure()) {
          const err = toHttpError(result.value)
          request.log.warn({ correlationId: request.correlationId, error: err }, 'get-item failed')
          return reply.status(err.statusCode).send(err)
        }

        return reply.send(ItemPresenter.toHTTP(result.value))
      },
    )
  }
}
