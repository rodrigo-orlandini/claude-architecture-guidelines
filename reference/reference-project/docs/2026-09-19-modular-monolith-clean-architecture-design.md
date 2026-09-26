# Design: Modular Monolith with Clean Architecture — Reference Project

**Date:** 2026-09-19
**Scope:** Architectural structure, conventions, environments, and development workflow

---

## 1. Context and Goal

E-commerce backend for a virtual storefront and asynchronous checkout integrated with an external ERP. Built as a modular monolith — single repository — structured so each module can be extracted as a microservice without rework.

Core requirements: cache with TTL and invalidation, full observability, concurrency control and overselling prevention, checkout idempotency, asynchronous resilience with retry and DLQ.

---

## 2. Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 |
| Language | TypeScript (strict) |
| HTTP | Fastify |
| DI / IoC | tsyringe + reflect-metadata |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Tests | Vitest |
| Containers | Docker + Docker Compose |

File and folder naming: kebab-case across the whole project, no exceptions.

---

## 3. Domain Modules

Three bounded contexts in the system:

| Module | Responsibility |
|---|---|
| `catalog` | Product storefront, Redis cache, ERP lookup |
| `checkout` | Orders, idempotency, asynchronous processing, ERP worker |
| `erp-adapter` | Fictional adapter for the external ERP (retry, timeout, fallback) |

---

## 4. Layer Structure per Module

```
src/modules/<module>/
├── entities/
│   ├── <entity>.ts
│   └── value-objects/
│       └── <value-object>.ts
├── use-cases/
│   └── <use-case>/
│       ├── <use-case>.ts
│       └── <use-case>.spec.ts          # co-located unit test
├── repositories/
│   └── <repository>.ts                 # interface (port)
├── infra/
│   ├── http/
│   │   └── <controller>.ts
│   ├── persistence/
│   │   └── prisma-<repository>.ts      # Prisma implementation
│   └── cache/                          # catalog only
│       └── redis-<cache>.ts
├── mappers/
│   └── <entity>-mapper.ts
├── presenters/
│   └── <entity>-presenter.ts
├── dtos/
│   └── <use-case>-dto.ts
└── container.ts                        # module's tsyringe bindings
```

**Dependency rule (inviolable):**
- `entities/` imports nothing from outside its own domain file
- `use-cases/` imports only `entities/` and interfaces from `repositories/`
- `infra/` implements interfaces — never imported by use-cases or entities
- Modules do not import entities or use-cases from one another directly

---

## 5. Shared Infrastructure

```
src/shared/
├── core/
│   ├── either.ts          # Either<L,R>, left(), right(), Success<T>, Failure<E>
│   └── use-case.ts        # IUseCase<Input, Output> interface
├── errors/
│   ├── domain-error.ts    # abstract base class
│   └── http-error-mapper.ts  # DomainError → HTTP status + body
├── observability/
│   ├── logger.ts          # structured logger (pino)
│   ├── metrics.ts         # counters, gauges, histograms
│   └── tracer.ts          # trace/span (OpenTelemetry stub)
├── database/
│   └── prisma-client.ts   # singleton PrismaClient
└── types/
    └── pagination.ts      # cross-module types
```

---

## 6. Either Pattern for Error Handling

Use-cases return `Either<DomainError, OutputDTO>`.

```
entities / use-cases  →  Either<DomainError, T>
      ↓
controllers           →  match(either):
                           right → presenter → 2xx
                           left  → http-error-mapper → 4xx/5xx
```

No unhandled exception reaches the client. `DomainError` carries a semantic code (`OUT_OF_STOCK`, `ORDER_NOT_FOUND`, etc.) that the mapper converts into the correct HTTP status.

---

## 7. Value Objects

Extracted from fields with their own validation or behavior. Defined in `entities/value-objects/` of the corresponding module. Examples to confirm during domain modeling:

- `product-price.ts` — monetary value, no negatives
- `sku.ts` — product identifier, validated format
- `order-status.ts` — enum with valid transitions
- `quantity.ts` — positive integer, no zero

New VOs are added as the domain is modeled with the `domain-modeler` skill.

---

## 8. Docker Environments

### Development

```yaml
# docker-compose.yml
services:
  app:
    container_name: reference-project-app
    build: { context: ., target: dev }
    volumes: ["./src:/app/src"]         # hot reload via tsx watch
    depends_on: [postgres, redis]

  postgres:
    container_name: reference-project-postgres
    image: postgres:16-alpine
    environment: { POSTGRES_DB: reference_project_dev }

  redis:
    container_name: reference-project-redis
    image: redis:7-alpine
```

### Integration Tests

```yaml
# docker-compose.test.yml
services:
  postgres-test:
    container_name: reference-project-postgres-test
    image: postgres:16-alpine
    environment: { POSTGRES_DB: reference_project_test }
    ports: ["5433:5432"]

  redis-test:
    container_name: reference-project-redis-test
    image: redis:7-alpine
    ports: ["6380:6379"]
```

### Multistage Dockerfile

```dockerfile
FROM node:22-alpine AS base
FROM base AS dev      # tsx watch, source maps
FROM base AS build    # tsc compile
FROM base AS prod     # dist/ only, no devDependencies
```

---

## 9. Test Strategy

### Unit (`vitest.config.ts`)
- Entities, value-objects, use-cases, mappers, presenters, `either.ts`
- Repositories injected as **in-memory fakes** (implement the interface — not implementation mocks)
- `.spec.ts` co-located with the tested file
- No real I/O — fast, run in CI without external services

### Integration (`vitest.integration.ts`)
- Prisma implementations of the repositories against `reference-project-postgres-test`
- Redis implementations of the cache against `reference-project-redis-test`
- HTTP routes via Fastify's `app.inject()` (no real port)
- File: `<module>/infra/<layer>/<file>.integration-spec.ts`
- Isolation: `TRUNCATE TABLE ... CASCADE` in `beforeEach`

### Coverage Thresholds per Layer
| Layer | Minimum |
|---|---|
| use-cases | 90% |
| entities + value-objects | 85% |
| infra (integration) | 70% |

### TDD Loop
```
1. .spec.ts with expected behavior (red)
2. repository interface if needed
3. minimal implementation until green
4. refactor — no new functionality
```

---

## 10. Development Workflow per Session

### Skills and Agents

| Phase | Tool |
|---|---|
| Session start | `session-start` skill |
| Complex new feature / architectural decision | `brainstorming` skill |
| Entity, VO, or use-case modeling | `domain-modeler` skill |
| Implementation | `tdd-agent` |
| Observability check | `observability-enforcer` skill |
| Diff review | `arch-reviewer` agent |
| Before closing a task | `verification-before-completion` skill |

### Full Loop per Feature

```
session-start
  ↓ feature declared
domain-modeler         → entity/VO modeled, CONTEXT.md updated
  ↓
tdd-agent              → red → green → refactor per use-case
  ↓
observability-enforcer → correlationId, metrics, spans present
  ↓
arch-reviewer          → dependency rule, Either, kebab-case, DI ok
  ↓
verification-before-completion → everything checked
  ↓
commit
```

---

## 11. Definition of Agents and Skills to Create

### `arch-reviewer` (agent)
Analyzes diff or module. Reports in the format `file:line severity: problem. fix.`:
- Forbidden import between layers
- Direct cross-module import without an interface
- Use-case without an `Either` return
- `new` in a service bypassing DI
- File/folder outside kebab-case
- Business logic in a controller

### `tdd-agent` (agent)
Drives the red→green→refactor loop:
- Requires a `.spec.ts` before accepting the implementation
- Runs `vitest run` and blocks on red
- Checks coverage per layer against the defined thresholds
- Detects tautological tests and internal mocking (both forbidden)

### `domain-modeler` (skill)
Before writing an entity or VO:
- Extracts VO candidates from fields with their own validation
- Validates naming against `CONTEXT.md`
- Proposes invariants and which layer they belong to

### `observability-enforcer` (skill)
Checklist before closing a use-case or controller:
- `correlationId` propagated in the logger on every request
- `orderId` present in logs wherever an order exists
- Cache hit/miss instrumented in the `catalog` module
- Span created for `GET /products` and `POST /checkout`
- No `console.log` — structured logger only (pino)

### `session-start` (skill)
Session start:
- Loads `CONTEXT.md` and `architecture-rules.md`
- Shows the project's current state
- Routes to the correct skill/agent based on task type

---

## 12. Convention Files to Create

`CONTEXT.md` (root) — living domain glossary, updated as modeling progresses.

`src/shared/core/architecture-rules.md` — review checklist referenced by all agents:
- Entities do not import from `infra/` or other modules
- Use-cases return `Either<DomainError, T>`
- Controllers only match on the Either and delegate to the presenter
- Every file and folder in kebab-case
- In-memory fakes for unit tests — never implementation mocks
- Every use-case has a co-located `.spec.ts`

---

## 13. `package.json` Scripts

```json
{
  "dev": "docker compose up",
  "test:unit": "vitest run",
  "test:integration": "docker compose -f docker-compose.test.yml up -d && vitest run --config vitest.integration.ts",
  "test:all": "npm run test:unit && npm run test:integration",
  "lint": "eslint src --ext .ts",
  "typecheck": "tsc --noEmit"
}
```
