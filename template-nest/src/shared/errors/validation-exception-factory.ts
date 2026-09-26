import { BadRequestException } from '@nestjs/common'
import type { ValidationError } from '@nestjs/common'

// Wired into the global ValidationPipe's `exceptionFactory` (main.ts). Without
// this, Nest's default 400 body is {message, error: 'Bad Request', statusCode}
// — a different shape than every domain-error response's {statusCode, error,
// message} (see http-error-mapper.ts). This keeps the two consistent, and
// keeps the wire format identical to the Fastify and Go siblings' 400s.
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const message = errors
    .flatMap((error) => Object.values(error.constraints ?? {}))
    .join('; ') || 'Invalid request body'

  return new BadRequestException({
    statusCode: 400,
    error: 'INVALID_REQUEST_BODY',
    message,
  })
}
