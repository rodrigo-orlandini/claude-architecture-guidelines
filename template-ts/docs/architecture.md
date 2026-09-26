# Arquitetura — {{PROJECT_NAME}}

Monolito modular com Clean Architecture. Repositório único, mas cada módulo é um bounded context isolado, extraível como microsserviço sem retrabalho.

Regras de revisão (checklist curto): `src/shared/core/architecture-rules.md`.
Glossário de domínio: `CONTEXT.md`.

---

## 1. Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 22 |
| Linguagem | TypeScript (strict, decorators habilitados) |
| HTTP | Fastify 4 + @fastify/swagger (docs em `/docs`) |
| DI / IoC | tsyringe + reflect-metadata |
| ORM | Prisma 5 |
| Banco | PostgreSQL 16 |
| Cache / filas | Redis 7 (ioredis, BullMQ quando necessário) |
| Validação | JSON schema do Fastify na borda; zod para payloads externos |
| Logs | pino (JSON) + AsyncLocalStorage para correlationId |
| Métricas | prom-client (`GET /metrics`) |
| Tracing | OpenTelemetry (OTLP → Tempo, ou console) |
| Testes | Vitest 2 (unit, integration, coverage combinado) |
| Containers | Docker multistage + Docker Compose (dev, test, observability) |
| CI | GitHub Actions: build → unit ∥ integration → coverage 80% |

Nomenclatura de arquivos e pastas: kebab-case em todo o projeto, sem exceção.
Aliases de import: `@shared/*`, `@modules/*`, `@infra/*` (tsconfig + vitest + tsc-alias no build).

---

## 2. Estrutura de pastas

```
src/
├── main.ts                      # bootstrap: tracer → shared infra → módulos → HTTP → workers
├── infra/
│   └── http/
│       ├── server.ts            # Fastify: swagger, hooks correlationId/span/métrica, /health, /metrics, controllers
│       └── fastify-types.d.ts   # augment FastifyRequest { correlationId, span }
├── shared/
│   ├── container.ts             # registra clientes únicos (PrismaClient, Redis...)
│   ├── core/
│   │   ├── either.ts            # Either<L,R>, left(), right(), Success, Failure
│   │   ├── use-case.ts          # interface IUseCase<Input, Output>
│   │   └── architecture-rules.md
│   ├── errors/
│   │   ├── domain-error.ts      # classe base abstrata com `code`
│   │   └── http-error-mapper.ts # code → HTTP status
│   ├── observability/
│   │   ├── context.ts           # AsyncLocalStorage { correlationId, ...ids de negócio }
│   │   ├── logger.ts            # pino + getLogger() com contexto e traceId
│   │   ├── metrics.ts           # registry prom-client + métricas nomeadas
│   │   └── tracer.ts            # OpenTelemetry NodeSDK
│   ├── database/prisma-client.ts
│   └── types/pagination.ts
└── modules/
    └── <módulo>/
        ├── entities/
        │   ├── <entity>.ts (+ .spec.ts)
        │   └── value-objects/<vo>.ts (+ .spec.ts)
        ├── use-cases/
        │   ├── <verbo-substantivo>/
        │   │   ├── <verbo-substantivo>.ts
        │   │   ├── <verbo-substantivo>.spec.ts
        │   │   └── in-memory-<port>.ts        # fake usado só por este use-case
        │   └── in-memory-<port>.ts            # fake compartilhado
        ├── repositories/<nome>-repository.ts  # interfaces (ports) — IFooRepository
        ├── errors/<nome>-error.ts             # DomainErrors do módulo
        ├── dtos/<use-case>-dto.ts             # Input/Output dos use-cases
        ├── mappers/<entity>-mapper.ts         # linha do banco ↔ domínio
        ├── presenters/<entity>-presenter.ts   # domínio → contrato HTTP
        ├── infra/
        │   ├── http/<recurso>-controller.ts
        │   ├── persistence/prisma-<nome>-repository.ts (+ .integration-spec.ts)
        │   ├── cache/redis-<nome>.ts
        │   └── queue/bullmq-<nome>-worker.ts
        └── container.ts                       # register<Modulo>Module()
```

Enquanto existir, `src/modules/example/` implementa todas as camadas: escrita (`POST /items` → 201), leitura paginada (`GET /items`), leitura por id com 404 (`GET /items/:itemId`), VO simples (`item-name.ts`), VO enum com máquina de estados (`item-status.ts`), comportamento de entity (`Item.archive()`), mapper, presenter e repository Prisma com integration spec. Copie o padrão; o roteiro de remoção está no passo 8 do `BOOTSTRAP.md` do kit `_architecture`. Rotas HTTP testadas via `app.inject` em `infra/http/item-controller.integration-spec.ts`. Depois da remoção, o módulo real mais completo em `src/modules/` passa a ser a referência (atualize este parágrafo).

---

## 3. Regra de dependência (inviolável)

```
infra/http (controller) ──► use-cases ──► entities / value-objects
        │                      │
        │                      └──► repositories/ (interfaces)
        ▼                                   ▲
    presenters                              │ implementa
                          infra/persistence ┘
```

- `entities/` não importa nada fora do domínio do módulo (só `@shared/core` e `@shared/errors`).
- `use-cases/` importa apenas entities, dtos, errors e interfaces de `repositories/`.
- `infra/` implementa interfaces; ninguém de dentro importa `infra/`.
- Módulos não importam entities/use-cases uns dos outros. Comunicação cross-module: um módulo define a interface (port) no próprio `repositories/`, o outro implementa, e o `container.ts` liga.
- Wiring só em `container.ts`; `main.ts` chama `register<Modulo>Module()` de cada módulo.

---

## 4. Either e erros

```
entity / VO   → static create(): Either<InvalidXError, X>
use-case      → Promise<Either<DomainError, Output>>
controller    → result.isFailure() ? toHttpError(result.value) → 4xx/5xx
                                   : Presenter.toHTTP(result.value) → 2xx
```

- Nenhuma exceção de domínio é lançada; só `left(...)`. Exceções ficam para bugs e falhas de infra.
- Status: validação de VO 422, não encontrado 404, conflito/transição inválida 409, forma do body 400 (schema Fastify).
- `DomainError.code` em UPPER_SNAKE; cada code novo tem status no `http-error-mapper.ts`.
- Mapper (DB → domínio) pode lançar ao encontrar linha corrompida — é bug de dados, não fluxo de negócio.

---

## 5. Value Objects e Entities

- VO: construtor privado, `static create(raw)` retornando Either, `readonly value`.
- Entity: construtor privado, `static create(props, id?)`, props privadas com getters.
- Invariante estrutural na entity/VO; regra de aplicação no use-case (skill `domain-modeler` decide).
- Enum de domínio: VO com lista `as const` + `transitionTo()`; coluna `String` no banco, validada no mapper.
- Regra dependente de hora: `now` no input do use-case ou `IClock` injetado.

---

## 6. Testes

| Tipo | Arquivo | Config | I/O | Dependências |
|---|---|---|---|---|
| Unit | `*.spec.ts` co-locado | `vitest.config.ts` | nenhum | fakes in-memory que implementam a interface |
| Integration | `*.integration-spec.ts` em `infra/` | `vitest.integration.ts` | Postgres/Redis reais (`docker-compose.test.yml`, portas 5433/6380) | clientes reais; isolamento com TRUNCATE no `beforeEach` |
| Coverage | ambos | `vitest.coverage.ts` | ambos | threshold global 80% |

`npm run typecheck` checa também os specs (`tsconfig.spec.json`); o Vitest não checa tipos.

Rotas HTTP podem ser testadas em integration via `app.inject()` do Fastify (sem porta).

Proibido: `vi.mock()` de implementação de infra em unit, teste tautológico, horizontal slicing (todos os testes antes de qualquer código).

Alvo por camada: use-cases 90%, entities/VOs 85%, infra 70%.

Loop TDD: spec red → interface do repository se necessária → implementação mínima green → refactor.

---

## 7. Observabilidade

- Hook `onRequest`: lê `x-correlation-id` (ou usa `request.id`), devolve no header, grava no AsyncLocalStorage, abre span `http.request`.
- `addToContext({ orderId })` junta ids de negócio ao contexto; todo `getLogger()` seguinte do fluxo os inclui.
- Hook `onResponse`: histograma `http_request_duration_ms{method,route,status_code}`, fecha span.
- `getLogger()` em use-cases/infra injeta `correlationId`, `traceId`, `spanId` e ids extras do contexto.
- Métricas de negócio declaradas em `shared/observability/metrics.ts`.
- Fluxos assíncronos (fila, outbox): propague `correlationId` e o id de negócio no payload do job e reabra o contexto no worker com `runWithContext`.
- Stack local: `node scripts/compose.mjs -f docker-compose.observability.yml up -d` → Grafana `:3001`, Prometheus `:9090`, Tempo `:3200/:4318`, Loki `:3100`.

---

## 8. Ambientes Docker

- `Dockerfile` multistage: `dev` (tsx watch), `build` (tsc + tsc-alias), `prod` (só `dist/` + deps de produção).
- `docker-compose.yml`: app + Postgres 16 + Redis 7 com healthcheck; `container_name` explícito `{{project-slug}}-*`.
- `docker-compose.test.yml`: Postgres (5433) e Redis (6380) isolados para integration; schema aplicado com `prisma db push --force-reset` (banco descartável).
- Schema em dev/prod: migrations (`prisma/migrations/`, criadas com `npm run db:migrate`, aplicadas com `prisma migrate deploy` — o container `dev` roda isso ao subir).
- `docker-compose.observability.yml`: Prometheus, Tempo, Loki, Promtail, Grafana provisionado.
- `scripts/compose.mjs`: wrapper de `docker compose` — usa Docker nativo ou, no Windows sem Docker Desktop, `wsl docker`. Todos os scripts npm passam por ele.

---

## 9. Fluxo de desenvolvimento por sessão

| Fase | Ferramenta |
|---|---|
| Início de sessão | skill `session-start` |
| Feature nova / decisão arquitetural | `superpowers:brainstorming` → spec em `docs/superpowers/specs/AAAA-MM-DD-<tema>-design.md` |
| Plano de implementação | `superpowers:writing-plans` → `docs/superpowers/plans/AAAA-MM-DD-<tema>.md` |
| Execução do plano | `superpowers:subagent-driven-development` (ledger em `.superpowers/sdd/`, fora do git) |
| Modelagem de entity/VO | skill `domain-modeler` |
| Implementação | agente `tdd-agent` |
| Observabilidade | skill `observability-enforcer` |
| Revisão de diff | agente `arch-reviewer` |
| Antes de fechar | `superpowers:verification-before-completion` |
| Integração | `superpowers:finishing-a-development-branch` → PR |

```
session-start
  ↓ feature declarada (branch nova a partir de origin/main)
brainstorming → spec aprovada → writing-plans → plano aprovado
  ↓
domain-modeler         → entity/VO modelados, CONTEXT.md atualizado
  ↓
tdd-agent              → red → green → refactor por use-case
  ↓
observability-enforcer → correlationId, métricas, spans presentes
  ↓
arch-reviewer          → regra de dependência, Either, kebab-case, DI ok
  ↓
verification-before-completion → typecheck + testes rodados, saída conferida
  ↓
commit (Conventional Commits) → PR → CI verde → merge
```

Todo prompt relevante vai para `prompts/NN-<tema>.md` (ver `prompts/CLAUDE.md`) e é indexado em `PROMPTS.md`.
Decisões que não devem ser re-discutidas viram ADR em `docs/adr/NNNN-<titulo>.md`.
