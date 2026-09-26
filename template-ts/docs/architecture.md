# Architecture — {{PROJECT_NAME}}

Modular monolith with Clean Architecture. A single repository, but each module is an isolated bounded context, extractable as a microservice without rework.

Review rules (short checklist): `src/shared/core/architecture-rules.md`.
Domain glossary: `CONTEXT.md`.

This kit scales from a small CRUD service to a complex system. The reference module doesn't use a cache, a queue, or an outbox pattern — those (and full telemetry) are opt-in layers, added when a feature genuinely needs them, only after asking the user. See "Scope discipline" in `CLAUDE.md`.

---

## 1. Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 |
| Language | TypeScript (strict, decorators enabled) |
| HTTP | Fastify 4 + @fastify/swagger (docs at `/docs`) |
| DI / IoC | tsyringe + reflect-metadata |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Cache / queues | not used by the reference module — Redis is provisioned in `docker-compose.yml` as shared infra, ioredis/BullMQ get added only when a real feature needs them (ask first, see "Scope discipline") |
| Validation | Fastify JSON schema at the edge; zod for external payloads |
| Logs | pino (JSON) + AsyncLocalStorage for correlationId — always on |
| Metrics | prom-client (`GET /metrics`) — opt-in, see §7 |
| Tracing | OpenTelemetry (OTLP → Tempo, or console) — opt-in, see §7 |
| Tests | Vitest 2 (unit, integration, combined coverage) |
| Containers | Docker multistage + Docker Compose (dev, test, observability) |
| CI | GitHub Actions: build → unit ∥ integration → coverage 80% |

File and folder naming: kebab-case throughout the project, no exceptions.
Import aliases: `@shared/*`, `@modules/*`, `@infra/*` (tsconfig + vitest + tsc-alias in the build).

---

## 2. Folder structure

```
src/
├── main.ts                      # bootstrap: tracer → shared infra → modules → HTTP → workers
├── infra/
│   └── http/
│       ├── server.ts            # Fastify: swagger, correlationId/span/metric hooks, /health, /metrics, controllers
│       └── fastify-types.d.ts   # augment FastifyRequest { correlationId, span }
├── shared/
│   ├── container.ts             # registers single-instance clients (PrismaClient, Redis...)
│   ├── core/
│   │   ├── either.ts            # Either<L,R>, left(), right(), Success, Failure
│   │   ├── use-case.ts          # IUseCase<Input, Output> interface
│   │   └── architecture-rules.md
│   ├── errors/
│   │   ├── domain-error.ts      # abstract base class with `code`
│   │   └── http-error-mapper.ts # code → HTTP status
│   ├── observability/            # metrics.ts/tracer.ts present only if telemetry was enabled — see §7
│   │   ├── context.ts           # AsyncLocalStorage { correlationId, ...business ids }
│   │   ├── logger.ts            # pino + getLogger() with context and traceId
│   │   ├── metrics.ts           # prom-client registry + named metrics
│   │   └── tracer.ts            # OpenTelemetry NodeSDK
│   ├── database/prisma-client.ts
│   └── types/pagination.ts
└── modules/
    └── <module>/
        ├── entities/
        │   ├── <entity>.ts (+ .spec.ts)
        │   └── value-objects/<vo>.ts (+ .spec.ts)
        ├── use-cases/
        │   ├── <verb-noun>/
        │   │   ├── <verb-noun>.ts
        │   │   ├── <verb-noun>.spec.ts
        │   │   └── in-memory-<port>.ts        # fake used only by this use-case
        │   └── in-memory-<port>.ts            # shared fake
        ├── repositories/<name>-repository.ts  # interfaces (ports) — IFooRepository
        ├── errors/<name>-error.ts             # module DomainErrors
        ├── dtos/<use-case>-dto.ts             # use-case Input/Output
        ├── mappers/<entity>-mapper.ts         # DB row ↔ domain
        ├── presenters/<entity>-presenter.ts   # domain → HTTP contract
        ├── infra/
        │   ├── http/<resource>-controller.ts
        │   ├── persistence/prisma-<name>-repository.ts (+ .integration-spec.ts)
        │   ├── cache/redis-<name>.ts
        │   └── queue/bullmq-<name>-worker.ts
        └── container.ts                       # register<Module>Module()
```

While it exists, `src/modules/example/` implements all layers: writing (`POST /items` → 201), paginated reading (`GET /items`), read by id with 404 (`GET /items/:itemId`), a simple VO (`item-name.ts`), an enum VO with a state machine (`item-status.ts`), entity behavior (`Item.archive()`), mapper, presenter, and a Prisma repository with an integration spec. Copy the pattern; the removal steps are in step 8 of the `_architecture` kit's `BOOTSTRAP.md`. HTTP routes are tested via `app.inject` in `infra/http/item-controller.integration-spec.ts`. After removal, the most complete real module in `src/modules/` becomes the reference (update this paragraph).

---

## 3. Dependency rule (inviolable)

```
infra/http (controller) ──► use-cases ──► entities / value-objects
        │                      │
        │                      └──► repositories/ (interfaces)
        ▼                                   ▲
    presenters                              │ implements
                          infra/persistence ┘
```

- `entities/` does not import anything outside the module's domain (only `@shared/core` and `@shared/errors`).
- `use-cases/` imports only entities, dtos, errors, and interfaces from `repositories/`.
- `infra/` implements interfaces; nothing inside imports `infra/`.
- Modules do not import each other's entities/use-cases. Cross-module communication: one module defines the interface (port) in its own `repositories/`, the other implements it, and `container.ts` wires them together.
- Wiring only in `container.ts`; `main.ts` calls `register<Module>Module()` for each module.

---

## 4. Either and errors

```
entity / VO   → static create(): Either<InvalidXError, X>
use-case      → Promise<Either<DomainError, Output>>
controller    → result.isFailure() ? toHttpError(result.value) → 4xx/5xx
                                   : Presenter.toHTTP(result.value) → 2xx
```

- No domain exception is thrown; only `left(...)`. Exceptions are reserved for bugs and infra failures.
- Status codes: VO validation 422, not found 404, conflict/invalid transition 409, malformed body 400 (Fastify schema).
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

| Type | File | Config | I/O | Dependencies |
|---|---|---|---|---|
| Unit | co-located `*.spec.ts` | `vitest.config.ts` | none | in-memory fakes implementing the interface |
| Integration | `*.integration-spec.ts` in `infra/` | `vitest.integration.ts` | real Postgres/Redis (`docker-compose.test.yml`, ports 5433/6380) | real clients; isolation via TRUNCATE in `beforeEach` |
| Coverage | both | `vitest.coverage.ts` | both | 80% global threshold |

`npm run typecheck` also checks the specs (`tsconfig.spec.json`); Vitest does not type-check.

HTTP routes can be tested in integration via Fastify's `app.inject()` (no port).

Forbidden: `vi.mock()` of an infra implementation in unit tests, tautological tests, horizontal slicing (all tests before any code).

Target per layer: use-cases 90%, entities/VOs 85%, infra 70%.

TDD loop: red spec → repository interface if needed → minimal green implementation → refactor.

---

## 7. Observability (opt-in)

Decided once, at bootstrap (`BOOTSTRAP-TS.md`), by asking the user. Can also be added later, on request, following the same shape below.

**Always on, regardless of the answer:** structured logging (pino) + correlationId. Cheap, and useful at any project size — not considered "telemetry" for this decision.

**Only if enabled:**
- `onRequest` hook: reads `x-correlation-id` (or uses `request.id`), returns it in the header, stores it in AsyncLocalStorage, opens the `http.request` span.
- `addToContext({ orderId })` adds business ids to the current context; every subsequent `getLogger()` in the flow includes them.
- `onResponse` hook: `http_request_duration_ms{method,route,status_code}` histogram, closes the span.
- `getLogger()` in use-cases/infra injects `correlationId`, `traceId`, `spanId`, and extra ids from the context.
- Business metrics declared in `shared/observability/metrics.ts`.
- Async flows (queue, outbox): propagate `correlationId` and the business id in the job payload and reopen the context in the worker with `runWithContext`.
- Local stack: `node scripts/compose.mjs -f docker-compose.observability.yml up -d` → Grafana `:3001`, Prometheus `:9090`, Tempo `:3200/:4318`, Loki `:3100`.

**If declined:** none of `shared/observability/{metrics,tracer}.ts`, the span/metric calls in `server.ts`'s hooks, `docker-compose.observability.yml`, or `grafana/` exist in this project. `context.ts` + `logger.ts` still do — the hooks just seed the context and return the correlation header, no span/metric.

---

## 8. Docker environments

- `Dockerfile` multistage: `dev` (tsx watch), `build` (tsc + tsc-alias), `prod` (only `dist/` + production deps).
- `docker-compose.yml`: app + Postgres 16 + Redis 7 with healthcheck; explicit `container_name` `{{project-slug}}-*`.
- `docker-compose.test.yml`: isolated Postgres (5433) and Redis (6380) for integration; schema applied with `prisma db push --force-reset` (disposable database).
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

Bootstrap only scaffolds and validates — it does not run this loop automatically. See `BOOTSTRAP-TS.md`.

Every relevant prompt goes into `prompts/NN-<topic>.md` (see `prompts/CLAUDE.md`) and is indexed in `PROMPTS.md`.
Decisions that should not be re-discussed become an ADR in `docs/adr/NNNN-<title>.md`.
