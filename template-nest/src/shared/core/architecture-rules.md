# Architecture Rules — {{PROJECT_NAME}}

Review checklist referenced by `arch-reviewer`, `tdd-agent`, and `observability-enforcer`.
Nest variant of the Fastify sibling's rules — same principles, Nest's own DI/testing mechanism where the framework differs.

## Scope discipline

- Default to the simplest thing that works: a synchronous module, no cache, no queue, no outbox pattern.
- Before adding a cache, a queue/worker, an outbox pattern, or any other layer aimed at "large project" scale, **ask the user first** — see `CLAUDE.md`, "Scope discipline". This rule has no autonomous-mode exception.
- Observability (tracing/metrics/Grafana stack) is one of these opt-in layers too — see "Observability" below.

## Dependencies between layers

- `entities/` does not import anything from outside the module's own domain (only `@shared/core` and `@shared/errors`)
- `use-cases/` imports only `entities/`, `dtos/`, `errors/`, interfaces and tokens from `repositories/`, and, from shared, only `@shared/core`, `@shared/errors`, `@shared/observability`
- No domain/application layer imports `@prisma/client`, `fastify`, `@nestjs/platform-fastify`, or any other infra lib
- `infra/` implements interfaces — never imported by use-cases or entities
- Modules do not import each other's entities or use-cases directly
- Cross-module: only via an explicit interface + injection token in `repositories/` (port) or `shared/`
- Controllers (`infra/http/`) only call the use-case, match on the Either, and turn a `left` into an `HttpException` carrying the exact `toHttpError()` body — no business rule here

## Error handling

- Every use-case returns `Promise<Either<DomainError, T>>`
- VO/entity with validation: `static create(...)` returns `Either<InvalidXError, X>`
- Controllers only match on the Either: `isSuccess()` → presenter → 2xx; `isFailure()` → `toHttpError()` → `HttpException` → 4xx/5xx
- No unhandled exception reaches the client
- `DomainError` carries a semantic `code` in UPPER_SNAKE (e.g. `PRODUCT_NOT_FOUND`, `INVALID_EMAIL`, `SLOT_ALREADY_TAKEN`)
- Every new `code` gets an entry in `src/shared/errors/http-error-mapper.ts` (no entry = 500)
- HTTP status: VO validation → 422; resource not found → 404; conflict / invalid transition → 409; malformed body → 400 (global `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true`, automatic)

## Domain patterns

- Errors used by more than one file live in `errors/<name>-error.ts`; a validation error produced by a single VO can live in the VO's file (e.g. `InvalidEmailError` inside `email.ts`)
- Domain enum = VO with an `as const` list, `static create(raw)` validating, and `transitionTo()` when there's a state machine (e.g. `order-status.ts`; see `item-status.ts` in the example module while it exists). In the database: `String` column, validated by the VO in the mapper — do not use a Prisma enum
- Time-dependent rules: receive `now: Date` in the use-case's input (or inject `IClock`); never `new Date()` inside a tested business rule
- Invariant guaranteed by the database (unique, FK) under concurrency: the Prisma repository catches the error (e.g. `P2002`) and the port returns an `Either` with the corresponding DomainError; the use-case forwards the `left`. Don't rely only on "check before writing"
- Reference to a module that doesn't exist yet: store only the opaque id (UUID), with no FK or validation; record it as an assumption and add validation (via a port) once the module exists
- Write (POST/PUT): a `class-validator`-annotated DTO validates shape (`@IsString()`, etc.), the global `ValidationPipe` enforces it; use-case validates VOs, builds the entity, persists via the port, returns the entity; controller responds 201 (creation) / 200 via the presenter
- Cache, queue, outbox pattern: not present by default (see "Scope discipline"). When added, they're ports too — define the interface + injection token in `repositories/` or `shared/`, same as any other adapter, and ask the user before starting

## Naming

- Every file and folder in kebab-case, no exceptions
- Classes in PascalCase, variables and functions in camelCase
- Interfaces prefixed with `I` (e.g. `IItemRepository`) — a TypeScript-wide convention in this kit, unrelated to which framework/DI mechanism is in use
- Interface file WITHOUT the `i-` prefix: `repositories/item-repository.ts` contains `IItemRepository`
- Implementations prefixed by technology: `prisma-item-repository.ts`, `redis-item-cache.ts` (if a cache is ever added)
- Fakes: `in-memory-<name>.ts`, co-located in the folder of the use-case that uses them (or in `use-cases/` if shared by more than one)
- Use-case: folder `use-cases/<verb-noun>/` with `<verb-noun>.ts` + `.spec.ts`; class `<VerbNoun>UseCase`
- Module domain errors in `errors/<name>-error.ts`
- Nest-specific: controllers `<resource>.controller.ts`, modules `<name>.module.ts`, DTOs under `infra/http/dto/<name>.dto.ts`

## Dependency injection

Nest's own container replaces the Fastify sibling's tsyringe — no manual `container.ts` to keep in sync.

- No `new` on services, use-cases, or repositories outside a `*.module.ts` (specs may instantiate directly)
- Every injectable class decorated `@Injectable()`; constructor injection via `@Inject(TOKEN)` for interfaces, or plain constructor typing for concrete classes (e.g. `PrismaService`)
- Interface token: a `Symbol` exported next to the interface (e.g. `export const ITEM_REPOSITORY = Symbol('IItemRepository')` in `repositories/item-repository.ts`) — Nest resolves providers by token, not by structural type, since interfaces don't exist at runtime
- Each module's `*.module.ts` is the only file that binds a port to its concrete adapter (`{ provide: ITEM_REPOSITORY, useClass: PrismaItemRepository }`)
- `AppModule` (`src/app.module.ts`) only lists feature modules in `imports:` — it never constructs a provider itself
- In-memory fakes in unit tests implement the interface and are constructed with plain `new` — never mock a real adapter

## Tests

- Every use-case, entity, and VO has a co-located `.spec.ts`, run by the default `jest` config — no I/O, no Nest `TestingModule` needed (plain `new UseCase(fakeRepo)` is enough)
- e2e tests (needs real Postgres): under `test/`, suffix `.e2e-spec.ts`, run via `jest --config test/jest-e2e.json` — Nest's own convention for "needs real infra", the counterpart of the Fastify sibling's `.integration-spec.ts` and the Go sibling's `integration` build tag
- Full-stack e2e (`test/item.e2e-spec.ts`-style): boot the real Nest DI container (`Test.createTestingModule({ imports: [AppModule] }).compile()`) + real HTTP via `supertest` against `app.getHttpServer()` — proves wiring, middleware order, and validation together, not just the handler in isolation
- Repository-only e2e (`test/item-repository.e2e-spec.ts`-style): construct the adapter directly against a real `PrismaService`, no full app boot needed
- Integration isolation: `TRUNCATE ... CASCADE` in `beforeEach`
- Forbidden: tautological test (assertion recomputes the same value as the code)
- Forbidden: mocking a real adapter in a unit test — use the in-memory fake instead
- Minimum global coverage 80% (CI, via `jest.coverage.config.js`); target per layer: use-cases 90%, entities/VOs 85%, infra 70%
- Always test the "unknown field in the request body → 400" case for any new POST/PUT DTO — this is exactly the kind of thing a framework's default validation can silently get wrong (a real bug in the Fastify sibling's Ajv config was found this way)

## Observability

Structured logging + correlationId are always on (cheap, framework-agnostic, useful at any project size). Tracing/metrics/Grafana are opt-in — decided at bootstrap (`BOOTSTRAP-NEST.md`) or added later, on request.

If enabled:
- `correlationId` propagated on every request (`x-correlation-id` header or generated) via AsyncLocalStorage, seeded by `CorrelationIdMiddleware` (registered once in `app.module.ts`)
- Structured logs with pino: `getLogger()` in use-cases/infra, so every log picks up `correlationId`/`traceId` from the context automatically
- Business IDs (e.g. `orderId`, `userId`) in the context via `addToContext()` as soon as known
- Prometheus metrics in `@shared/observability/metrics`, exposed at `GET /metrics`
- OpenTelemetry spans on critical routes and use-cases
- Forbidden: `console.log` — structured logger only (exception: bootstrap fatal in `main.ts`)

If declined: skip the metrics/tracing bullets above; `correlationId` + structured logging still apply.
