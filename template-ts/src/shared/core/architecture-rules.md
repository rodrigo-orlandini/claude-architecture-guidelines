# Architecture Rules — {{PROJECT_NAME}}

Review checklist referenced by `arch-reviewer`, `tdd-agent`, and `observability-enforcer`.

## Dependencies between layers

- `entities/` does not import anything from outside the module's own domain (only `@shared/core` and `@shared/errors`)
- `use-cases/` imports only `entities/`, `dtos/`, `errors/`, interfaces from `repositories/`, and, from shared, only `@shared/core`, `@shared/errors`, `@shared/observability`, and `@shared/types`
- No domain/application layer imports `@prisma/client`, `fastify`, `ioredis`, or any other infra lib
- `infra/` implements interfaces — never imported by use-cases or entities
- Modules do not import each other's entities or use-cases directly
- Cross-module: only via an explicit interface in `repositories/` (port) or `shared/`
- Controllers (`infra/http/`) only call the use-case, match on the Either, and delegate to the presenter / http-error-mapper

## Error handling

- Every use-case returns `Promise<Either<DomainError, T>>`
- VO/entity with validation: `static create(...)` returns `Either<InvalidXError, X>`
- Controllers only match on the Either: `isSuccess()` → presenter → 2xx; `isFailure()` → `toHttpError()` → 4xx/5xx
- No unhandled exception reaches the client
- `DomainError` carries a semantic `code` in UPPER_SNAKE (e.g. `PRODUCT_NOT_FOUND`, `INVALID_EMAIL`, `SLOT_ALREADY_TAKEN`)
- Every new `code` gets an entry in `src/shared/errors/http-error-mapper.ts` (no entry = 500)
- HTTP status: VO validation → 422; resource not found → 404; conflict / invalid transition → 409; malformed body → 400 (Fastify schema, automatic)

## Domain patterns

- Errors used by more than one file live in `errors/<name>-error.ts`; a validation error produced by a single VO can live in the VO's file (e.g. `InvalidEmailError` inside `email.ts`)
- Domain enum = VO with an `as const` list, `static create(raw)` validating, and `transitionTo()` when there's a state machine (e.g. `order-status.ts`; see `item-status.ts` in the example module while it exists). In the database: `String` column, validated by the VO in the mapper — do not use a Prisma enum
- Time-dependent rules: receive `now: Date` in the use-case's input (or inject `IClock`); never `new Date()` inside a tested business rule
- Invariant guaranteed by the database (unique, FK) under concurrency: the Prisma repository catches the error (e.g. `P2002`) and the port returns an `Either` with the corresponding DomainError; the use-case forwards the `left`. Don't rely only on "check before writing"
- Reference to a module that doesn't exist yet: store only the opaque id (UUID), with no FK or validation; record it as an assumption and add validation (via a port) once the module exists
- Write (POST/PUT): controller validates shape with a JSON schema (`required`, `additionalProperties: false`); use-case validates VOs, builds the entity, persists via the port, returns the entity; controller responds 201 (creation) / 200 via the presenter

## Naming

- Every file and folder in kebab-case, no exceptions
- Classes in PascalCase, variables and functions in camelCase
- Interfaces prefixed with `I` (e.g. `IProductRepository`)
- Interface file WITHOUT the `i-` prefix: `repositories/product-repository.ts` contains `IProductRepository`
- Implementations prefixed by technology: `prisma-product-repository.ts`, `redis-product-cache.ts`, `bullmq-order-worker.ts`
- Fakes: `in-memory-<name>.ts`, co-located in the folder of the use-case that uses them (or in `use-cases/` if shared by more than one)
- Use-case: folder `use-cases/<verb-noun>/` with `<verb-noun>.ts` + `.spec.ts`; class `<VerbNoun>UseCase`
- Module domain errors in `errors/<name>-error.ts`

## Dependency injection

- No `new` on services, use-cases, or repositories outside `container.ts` (specs may instantiate directly)
- Every dependency injected via tsyringe (`@injectable`, `@inject('IToken')`)
- Interface token = interface name as a string (`'IProductRepository'`)
- Each module exposes `register<Module>Module()` in `container.ts`, called in `src/main.ts`
- In-memory fakes in unit tests implement the interface — never `vi.mock()` an implementation

## Tests

- Every use-case, entity, and VO has a co-located `.spec.ts`
- Unit tests: no real I/O (no Prisma, no Redis, no HTTP)
- Integration tests: `.integration-spec.ts` suffix, use real DB and Redis via Docker (`docker-compose.test.yml`)
- Integration isolation: `TRUNCATE ... CASCADE` / `deleteMany` in `beforeEach`
- Forbidden: tautological test (assertion recomputes the same value as the code)
- Forbidden: internal mocking (mocking a private method or an infra implementation in a unit test)
- Minimum global coverage 80% (CI); target per layer: use-cases 90%, entities/VOs 85%, infra 70%
- Specs are typed: `npm run typecheck` also runs `tsconfig.spec.json` (vitest/esbuild does not type-check)

## Observability

- `correlationId` propagated on every request (`x-correlation-id` header or generated) via AsyncLocalStorage
- Structured logs with pino: `getLogger()` outside a controller, `request.log` inside a controller
- Business IDs (e.g. `orderId`, `userId`) in the context via `addToContext()` as soon as known — appear in every subsequent log of the flow
- Prometheus metrics in `@shared/observability/metrics`, exposed at `GET /metrics`
- OpenTelemetry spans on critical routes and use-cases
- Forbidden: `console.log` — structured logger only (exception: bootstrap fatal in `main.ts`)
