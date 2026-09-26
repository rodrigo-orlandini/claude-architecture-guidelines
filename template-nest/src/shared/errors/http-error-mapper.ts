import type { DomainError } from './domain-error'

interface HttpError {
  statusCode: number
  error: string
  message: string
}

// Every new DomainError.code needs an entry here — no entry falls back to 500.
const HTTP_STATUS_MAP: Record<string, number> = {
  VALIDATION_ERROR: 422,
  // Malformed request body (unknown field, wrong type) caught by the global
  // ValidationPipe before any use-case runs — see validation-exception-factory.ts.
  INVALID_REQUEST_BODY: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ITEM_NOT_FOUND: 404,
  INVALID_ITEM_NAME: 422,
  INVALID_ITEM_STATUS: 422,
  INVALID_ITEM_STATUS_TRANSITION: 409,
}

export function toHttpError(error: DomainError): HttpError {
  const statusCode = HTTP_STATUS_MAP[error.code] ?? 500
  return {
    statusCode,
    error: error.code,
    message: error.message,
  }
}
