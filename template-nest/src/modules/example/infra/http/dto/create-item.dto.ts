import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsNotEmpty } from 'class-validator'

// Request body contract. The global ValidationPipe (main.ts) has
// `whitelist: true, forbidNonWhitelisted: true` — an unknown field gets
// rejected with 400 automatically, the Nest-idiomatic equivalent of the
// Fastify sibling's `additionalProperties: false` / Go's DisallowUnknownFields.
export class CreateItemDto {
  @ApiProperty({ example: 'Mug' })
  @IsString()
  @IsNotEmpty()
  name!: string
}
