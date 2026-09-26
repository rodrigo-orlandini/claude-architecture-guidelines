import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CreateItemUseCase } from '../../use-cases/create-item/create-item'
import { GetItemUseCase } from '../../use-cases/get-item/get-item'
import { ListItemsUseCase } from '../../use-cases/list-items/list-items'
import { ItemPresenter } from '../../presenters/item-presenter'
import { toHttpError } from '@shared/errors/http-error-mapper'
import type { DomainError } from '@shared/errors/domain-error'
import { CreateItemDto } from './dto/create-item.dto'
import { ListItemsQueryDto } from './dto/list-items-query.dto'

// Controller: calls exactly one use-case, matches the Either, and turns a
// left into an HttpException carrying the exact same {statusCode, error,
// message} body the Fastify and Go siblings return — no business rule here.
@ApiTags('Items')
@Controller('items')
export class ItemController {
  constructor(
    private readonly createItem: CreateItemUseCase,
    private readonly getItem: GetItemUseCase,
    private readonly listItems: ListItemsUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an item' })
  @ApiResponse({ status: 201, description: 'Item created' })
  @ApiResponse({ status: 400, description: 'Invalid request body (e.g. unknown field)' })
  @ApiResponse({ status: 422, description: 'Invalid item name' })
  async create(@Body() body: CreateItemDto) {
    const result = await this.createItem.execute({ name: body.name })
    if (result.isFailure()) throw toException(result.value)
    return ItemPresenter.toHTTP(result.value)
  }

  @Get(':itemId')
  @ApiOperation({ summary: 'Get an item by id' })
  @ApiParam({ name: 'itemId' })
  @ApiResponse({ status: 200, description: 'Item found' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async get(@Param('itemId') itemId: string) {
    const result = await this.getItem.execute({ itemId })
    if (result.isFailure()) throw toException(result.value)
    return ItemPresenter.toHTTP(result.value)
  }

  @Get()
  @ApiOperation({ summary: 'List items (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated item list' })
  async list(@Query() query: ListItemsQueryDto) {
    const result = await this.listItems.execute({ page: query.page, limit: query.limit })
    if (result.isFailure()) throw toException(result.value)
    return ItemPresenter.toHTTPList(result.value)
  }
}

function toException(error: DomainError): HttpException {
  const body = toHttpError(error)
  return new HttpException(body, body.statusCode)
}
