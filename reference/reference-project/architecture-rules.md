# Architecture Rules — Reference Project

Review checklist referenced by `arch-reviewer` and `observability-enforcer`.

## Dependencies between layers

- `entities/` imports nothing from outside its own domain file
- `use-cases/` imports only `entities/` and interfaces from `repositories/`
- `infra/` implements interfaces — never imported by use-cases or entities
- Modules do not import entities or use-cases from one another directly
- Cross-module: only via an explicit interface in `repositories/` or `shared/`

## Error handling

- Every use-case returns `Either<DomainError, T>`
- Controllers only pattern-match on the Either and delegate to the presenter (right) or the http-error-mapper (left)
- No unhandled exception reaches the client
- `DomainError` carries a semantic `code` (e.g.: `OUT_OF_STOCK`, `ORDER_NOT_FOUND`)

## Naming

- Every file and folder in kebab-case, no exceptions
- Classes in PascalCase, variables and functions in camelCase
- Interfaces prefixed with `I` (e.g.: `IProductRepository`)

## Dependency injection

- No `new` in services, use-cases, or repositories outside `container.ts`
- Every dependency injected via tsyringe (`@injectable`, `@inject`)
- In-memory fakes in unit tests implement the interface — never `vi.mock()` an implementation

## Tests

- Every use-case has a co-located `.spec.ts`
- Unit tests: no real I/O (no Prisma, no Redis, no HTTP)
- Integration tests: `.integration-spec.ts` suffix, use real DB and Redis via Docker
- Forbidden: tautological test (assertion recomputes the same value as the code)
- Forbidden: internal mocking (mocking a private method or infra implementation in a unit test)

## Observability

- `correlationId` propagated in the logger on every request
- `orderId` present in logs wherever an order exists
- Cache hit/miss instrumented in the `catalog` module
- Span created for `GET /products` and `POST /checkout`
- Forbidden: `console.log` — structured logger only (pino)
