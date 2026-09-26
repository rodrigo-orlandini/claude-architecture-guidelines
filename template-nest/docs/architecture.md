# Architecture — {{PROJECT_NAME}}

Modular monolith with Clean Architecture. A single repository, but each module is an isolated bounded context, extractable as a microservice without rework.

Review rules (short checklist): `src/shared/core/architecture-rules.md`.
Domain glossary: `CONTEXT.md`.

This kit scales from a small CRUD service to a complex system. It doesn't ship a cache, a queue, or an outbox pattern by default — those (and full telemetry) are opt-in layers, added when a feature genuinely needs them, only after asking the user. See "Scope discipline" in `CLAUDE.md`.

---

## 1. Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 |
| Language | TypeScript (strict, decorators enabled) |
| Framework | NestJS 12, `@nestjs/platform-fastify` adapter |
| DI / IoC | Nest's built-in container (`@Injectable`, `@Inject(token)`, `@Module`) |
| ORM | Prisma 5, via `PrismaService` (Nest lifecycle-managed) |
| Database | PostgreSQL 16 |
| Cache / queues | not included by default — see "Scope discipline" |
| Validation | `class-validator` + `class-transformer`, enforced by a global `ValidationPipe` |
| API docs | `@nestjs/swagger` (docs at `/docs`) |
| Logs | pino (JSON) + AsyncLocalStorage for correlationId — always on |
| Metrics | prom-client (`GET /metrics`) — opt-in, see §7 |
| Tracing | OpenTelemetry (OTLP → Tempo, or console) — opt-in, see §7 |
| Tests | Jest 30 (unit `*.spec.ts`, e2e `test/*.e2e-spec.ts`, combined coverage) |
| Containers | Docker multistage + Docker Compose (dev, test, observability) |
| CI | GitHub Actions: build → unit ∥ integration → coverage 80% |

File and folder naming: kebab-case throughout the project, no exceptions.
Import aliases: `@shared/*`, `@modules/*` (tsconfig `paths` + Jest `moduleNameMapper`).

---

## 2. Folder structure

```
src/
├── main.ts                      # bootstrap: tracer (if enabled) → Nest app → global pipe → swagger → /health, /metrics → listen
├── app.module.ts                 # imports feature modules; registers CorrelationIdMiddleware for all routes
├── shared/
│   ├── core/
│   │   ├── either.ts             # Either<L,R>, left(), right(), Success, Failure
│   │   ├── use-case.ts           # IUseCase<Input, Output> interface
│   │   └── architecture-rules.md
│   ├── errors/
│   │   ├── domain-error.ts       # abstract base class with `code`
│   │   └── http-error-mapper.ts  # code → HTTP status
│   ├── observability/            # present only if observability was enabled — see §7
│   │   ├── context.ts            # AsyncLocalStorage { correlationId, ...business ids }
│   │   ├── logger.ts             # pino + getLogger() with context and traceId
│   │   ├── correlation-id.middleware.ts  # Nest middleware: seeds context, opens root span, records duration
│   │   ├── metrics.ts            # prom-client registry + named metrics
│   │   └── tracer.ts             # OpenTelemetry NodeSDK
│   └── database/
│       ├── prisma.service.ts     # PrismaClient wrapped in Nest's OnModuleInit/OnModuleDestroy
│       └── prisma.module.ts      # @Global module exporting PrismaService
└── modules/
    └── <module>/
        ├── entities/
        │   ├── <entity>.ts (+ .spec.ts)
        │   └── value-objects/<vo>.ts (+ .spec.ts)
        ├── use-cases/
        │   ├── <verb-noun>/
        │   │   ├── <verb-noun>.ts        # @Injectable(), @Inject(TOKEN) for ports
        │   │   └── <verb-noun>.spec.ts
        │   └── in-memory-<port>.ts       # shared fake (plain class, no decorator)
        ├── repositories/<name>-repository.ts  # port interface + injection token (Symbol)
        ├── errors/<name>-error.ts             # module DomainErrors
        ├── dtos/<use-case>-dto.ts             # use-case Input/Output (plain types, not HTTP DTOs)
        ├── mappers/<entity>-mapper.ts         # DB row ↔ domain
        ├── presenters/<entity>-presenter.ts   # domain → HTTP contract
        ├── infra/
        │   ├── http/
        │   │   ├── <resource>.controller.ts
        │   │   └── dto/<name>.dto.ts          # class-validator request DTOs
        │   └── persistence/prisma-<name>-repository.ts
        └── <module>.module.ts                 # binds port → adapter; only file that knows both sides
test/
├── jest-e2e.json, jest-e2e.setup.ts
├── <resource>.e2e-spec.ts             # full app + real HTTP (supertest) + real Postgres
└── <resource>-repository.e2e-spec.ts  # adapter directly against real Postgres, no full app boot
```

While it exists, `src/modules/example/` implements all layers: writing (`POST /items` → 201), paginated reading (`GET /items`), read by id with 404 (`GET /items/:itemId`), a simple VO (`item-name.ts`), an enum VO with a state machine (`item-status.ts`), entity behavior (`Item.archive()`), mapper, presenter, and a Prisma repository. Copy the pattern; the removal steps are in `BOOTSTRAP-NEST.md`'s "Building the first module" section. HTTP routes are tested via `test/item.e2e-spec.ts` (full Nest `TestingModule` + `supertest`). After removal, the most complete real module in `src/modules/` becomes the reference (update this paragraph).

---

## 3. Dependency rule (inviolable)

```
infra/http (controller) ──► use-cases ──► entities / value-objects
        │                      │
        │                      └──► repositories/ (interface + token)
        ▼                                   ▲
    presenters                              │ implements
                          infra/persistence ┘
```

- `entities/` does not import anything outside the module's domain (only `@shared/core` and `@shared/errors`).
- `use-cases/` imports only entities, dtos, errors, and interfaces/tokens from `repositories/`.
- `infra/` implements interfaces; nothing inside imports `infra/`.
- Modules do not import each other's entities/use-cases. Cross-module communication: one module defines the interface (port) + token in its own `repositories/`, the other implements it, and the consuming module's `*.module.ts` wires them together.
- Wiring only in `*.module.ts` files; `app.module.ts` only lists feature modules in `imports:`.

---

## 4. Either and errors

```
entity / VO   → static create(): Either<InvalidXError, X>
use-case      → Promise<Either<DomainError, Output>>
controller    → result.isFailure() ? new HttpException(toHttpError(result.value), status) → 4xx/5xx
                                   : Presenter.toHTTP(result.value) → 2xx
```

- No domain exception is thrown; only `left(...)`. Exceptions are reserved for bugs and infra failures.
- Status codes: VO validation 422, not found 404, conflict/invalid transition 409, malformed body 400 (global `ValidationPipe`).
- `DomainError.code` in UPPER_SNAKE; every new code gets a status in `http-error-mapper.ts`.
- Mapper (DB → domain) may throw when it finds a corrupted row — that's a data bug, not a business flow.

---

## 5. Value Objects and Entities

- VO: private constructor, `static create(raw)` returning Either, `readonly value`.
- Entity: private constructor, `static create(props, id?)`, private props with getters.
- Structural invariant in the entity/VO; application rule in the use-case (the `domain-modeler` skill decides).
- Domain enum: VO with an `as const` list + `transitionTo()`; `String` column in the database, validated in the mapper.
- Time-dependent rule: `now` in the use-case's input or `IClock` injected.

---

## 6. Tests

| Type | File | Run with | I/O | Dependencies |
|---|---|---|---|---|
| Unit | co-located `*.spec.ts` | `npm run test:unit` (default `jest` config) | none | in-memory fakes, plain `new UseCase(fake)` |
| e2e | `test/*.e2e-spec.ts` | `npm run test:integration` (`jest --config test/jest-e2e.json`) | real Postgres (`docker-compose.test.yml`, port 5433) | real `PrismaService`; full boot uses `Test.createTestingModule` + `supertest` |
| Coverage | both | `npm run test:coverage` (`jest.coverage.config.js`) | both | 80% global threshold |

`npm run typecheck` also checks `test/`.

Forbidden: mocking a real adapter in a unit test, tautological tests, horizontal slicing (all tests before any code).

Target per layer: use-cases 90%, entities/VOs 85%, infra 70%.

Always add a "rejects an unknown field with 400" e2e test for any new write DTO.

TDD loop: red spec → repository interface + token if needed → minimal green implementation → refactor.

---

## 7. Observability (opt-in)

Decided once, at bootstrap (`BOOTSTRAP-NEST.md`), by asking the user. Can also be added later, on request, following the same shape below.

**Always on, regardless of the answer:** structured logging (pino) + correlationId. Cheap, and useful at any project size — not considered "telemetry" for this decision.

**Only if enabled:**
- `CorrelationIdMiddleware` (registered in `app.module.ts` for all routes): reads `x-correlation-id` (or mints one), returns it in the response header, seeds AsyncLocalStorage, opens the `http.request` span, records `http_request_duration_ms{method,route,status_code}` on completion.
- `addToContext({ orderId })` adds business ids to the current context; every subsequent `getLogger()` in the flow includes them.
- `getLogger()` in use-cases/infra injects `correlationId`, `traceId`, `spanId`, and extra ids from the context.
- Business metrics declared in `shared/observability/metrics.ts`, exposed at `GET /metrics`.
- Async flows (queue, outbox — if ever added): propagate `correlationId` and the business id in the job payload, reopen the context in the worker.
- Local stack: `node scripts/compose.mjs -f docker-compose.observability.yml up -d` → Grafana `:3001`, Prometheus `:9090`, Tempo `:3200/:4318`, Loki `:3100`.

**If declined:** none of `shared/observability/{metrics,tracer}.ts`, `correlation-id.middleware.ts`'s span/metric calls, `docker-compose.observability.yml`, or `grafana/` exist in this project. `context.ts` + `logger.ts` still do — a lighter middleware just seeds the context and returns the correlation header, no span/metric.

---

## 8. Docker environments

- `Dockerfile` multistage: `dev` (`nest start --watch`), `build` (`nest build`), `prod` (only `dist/` + production deps).
- `docker-compose.yml`: app + Postgres 16 with healthcheck; explicit `container_name` `{{project-slug}}-*`. No Redis (see "Scope discipline").
- `docker-compose.test.yml`: isolated Postgres (5433) for integration; schema applied with `prisma db push --force-reset` (disposable database).
- Schema in dev/prod: migrations (`prisma/migrations/`, created with `npm run db:migrate`, applied with `prisma migrate deploy` — the `dev` container runs this on startup).
- `docker-compose.observability.yml` + `grafana/`: only present if observability was enabled (§7).
- `scripts/compose.mjs`: `docker compose` wrapper — uses native Docker or, on Windows without Docker Desktop, `wsl docker`. All npm scripts go through it.

---

## 9. Development flow per session

| Phase | Tool |
|---|---|
| Start of session | `session-start` skill |
| New feature / architectural decision | `superpowers:brainstorming` → spec in `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` |
| Implementation plan | `superpowers:writing-plans` → `docs/superpowers/plans/YYYY-MM-DD-<topic>.md` |
| Plan execution | `superpowers:subagent-driven-development` (ledger in `.superpowers/sdd/`, outside git) |
| Entity/VO modeling | `domain-modeler` skill |
| Implementation | `tdd-agent` agent |
| Observability | `observability-enforcer` skill (only if enabled, §7) |
| Diff review | `arch-reviewer` agent |
| Before closing | `superpowers:verification-before-completion` |
| Integration | `superpowers:finishing-a-development-branch` → PR |

```
session-start
  ↓ declared feature (new branch from origin/main)
brainstorming → approved spec → writing-plans → approved plan
  ↓
domain-modeler         → entity/VO modeled, CONTEXT.md updated
  ↓
tdd-agent              → red → green → refactor per use-case
  ↓
observability-enforcer → correlationId always; metrics/spans only if enabled
  ↓
arch-reviewer          → dependency rule, Either, kebab-case, DI ok
  ↓
verification-before-completion → typecheck + tests run, output checked
  ↓
commit (Conventional Commits) → PR → green CI → merge
```

Bootstrap only scaffolds and validates — it does not run this loop automatically. See `BOOTSTRAP-NEST.md`.

Every relevant prompt goes into `prompts/NN-<topic>.md` (see `prompts/CLAUDE.md`) and is indexed in `PROMPTS.md`.
Decisions that should not be re-discussed become an ADR in `docs/adr/NNNN-<title>.md`.
