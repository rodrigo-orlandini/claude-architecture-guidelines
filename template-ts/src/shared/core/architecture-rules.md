# Regras de Arquitetura — {{PROJECT_NAME}}

Checklist de revisão referenciado por `arch-reviewer`, `tdd-agent` e `observability-enforcer`.

## Dependências entre camadas

- `entities/` não importa nada de fora do próprio domínio do módulo (só `@shared/core` e `@shared/errors`)
- `use-cases/` importa apenas `entities/`, `dtos/`, `errors/`, interfaces de `repositories/` e, de shared, só `@shared/core`, `@shared/errors`, `@shared/observability` e `@shared/types`
- Nenhuma camada de domínio/aplicação importa `@prisma/client`, `fastify`, `ioredis` ou outra lib de infra
- `infra/` implementa interfaces — nunca é importada por use-cases ou entities
- Módulos não importam entities ou use-cases uns dos outros diretamente
- Cross-module: apenas via interface explícita em `repositories/` (port) ou `shared/`
- Controllers (`infra/http/`) só chamam use-case, fazem match no Either e delegam ao presenter / http-error-mapper

## Tratamento de erros

- Todo use-case retorna `Promise<Either<DomainError, T>>`
- VO/entity com validação: `static create(...)` retorna `Either<InvalidXError, X>`
- Controllers só fazem match no Either: `isSuccess()` → presenter → 2xx; `isFailure()` → `toHttpError()` → 4xx/5xx
- Nenhuma exceção não tratada chega ao cliente
- `DomainError` carrega `code` semântico em UPPER_SNAKE (ex: `PRODUCT_NOT_FOUND`, `INVALID_EMAIL`, `SLOT_ALREADY_TAKEN`)
- Todo `code` novo ganha entrada em `src/shared/errors/http-error-mapper.ts` (sem entrada = 500)
- Status HTTP: validação de VO → 422; recurso inexistente → 404; conflito / transição inválida → 409; forma do body inválida → 400 (schema Fastify, automático)

## Padrões de domínio

- Erros usados por mais de um arquivo ficam em `errors/<nome>-error.ts`; erro de validação produzido só por um VO pode ficar no arquivo do VO (ex.: `InvalidEmailError` dentro de `email.ts`)
- Enum de domínio = VO com lista `as const`, `static create(raw)` validando e `transitionTo()` quando houver máquina de estados (ex.: `order-status.ts`; ver `item-status.ts` no módulo example enquanto existir). No banco: coluna `String`, validada pelo VO no mapper — não usar enum Prisma
- Regras que dependem de hora: receber `now: Date` no input do use-case (ou injetar `IClock`); nunca `new Date()` dentro de regra de negócio testada
- Invariante garantida pelo banco (unique, FK) sob concorrência: o repository Prisma captura o erro (ex.: `P2002`) e o port retorna `Either` com o DomainError correspondente; o use-case repassa o `left`. Não confie só em "consultar antes de gravar"
- Referência a módulo que ainda não existe: guarde só o id opaco (UUID), sem FK nem validação; registre como premissa e adicione a validação (via port) quando o módulo existir
- Escrita (POST/PUT): controller valida forma com JSON schema (`required`, `additionalProperties: false`); use-case valida VOs, monta entity, persiste via port, retorna entity; controller responde 201 (criação) / 200 via presenter

## Nomenclatura

- Todo arquivo e pasta em kebab-case, sem exceção
- Classes em PascalCase, variáveis e funções em camelCase
- Interfaces prefixadas com `I` (ex: `IProductRepository`)
- Arquivo de interface SEM prefixo `i-`: `repositories/product-repository.ts` contém `IProductRepository`
- Implementações prefixadas pela tecnologia: `prisma-product-repository.ts`, `redis-product-cache.ts`, `bullmq-order-worker.ts`
- Fakes: `in-memory-<nome>.ts`, co-locados na pasta do use-case que os usa (ou em `use-cases/` se compartilhados por mais de um)
- Use-case: pasta `use-cases/<verbo-substantivo>/` com `<verbo-substantivo>.ts` + `.spec.ts`; classe `<VerboSubstantivo>UseCase`
- Erros de domínio do módulo em `errors/<nome>-error.ts`

## Injeção de dependência

- Nenhum `new` em services, use-cases ou repositories fora de `container.ts` (specs podem instanciar direto)
- Toda dependência injetada via tsyringe (`@injectable`, `@inject('IToken')`)
- Token de interface = nome da interface em string (`'IProductRepository'`)
- Cada módulo expõe `register<Modulo>Module()` em `container.ts`, chamado em `src/main.ts`
- Fakes in-memory em testes unitários implementam a interface — nunca `vi.mock()` de implementação

## Testes

- Toda use-case, entity e VO tem `.spec.ts` co-locado
- Unit tests: sem I/O real (sem Prisma, sem Redis, sem HTTP)
- Integration tests: sufixo `.integration-spec.ts`, usam DB e Redis reais via Docker (`docker-compose.test.yml`)
- Isolamento de integration: `TRUNCATE ... CASCADE` / `deleteMany` no `beforeEach`
- Proibido: teste tautológico (assertion recomputa o valor igual ao código)
- Proibido: mock de internal (mockar método privado ou implementação de infra em unit test)
- Coverage mínimo global 80% (CI); alvo por camada: use-cases 90%, entities/VOs 85%, infra 70%
- Specs são tipados: `npm run typecheck` também roda `tsconfig.spec.json` (vitest/esbuild não checa tipos)

## Observabilidade

- `correlationId` propagado em todo request (header `x-correlation-id` ou gerado) via AsyncLocalStorage
- Logs estruturados com pino: `getLogger()` fora de controller, `request.log` dentro de controller
- IDs de negócio (ex: `orderId`, `userId`) no contexto via `addToContext()` assim que conhecidos — aparecem em todo log seguinte do fluxo
- Métricas Prometheus em `@shared/observability/metrics`, expostas em `GET /metrics`
- Spans OpenTelemetry em rotas e use-cases críticos
- Proibido: `console.log` — apenas logger estruturado (exceção: fatal de bootstrap em `main.ts`)
