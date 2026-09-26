# Arquitetura — {{PROJECT_NAME}}

Monolito modular com Clean Architecture, em Go. Mesma filosofia do kit TypeScript (repositório único, cada módulo um bounded context extraível como microsserviço sem retrabalho), mecanismo idiomático diferente onde a linguagem pede.

Regras de revisão (checklist curto): `docs/architecture-rules.md`.
Glossário de domínio: `CONTEXT.md`.

---

## 1. Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Go 1.26+ |
| HTTP | `net/http` puro — `http.ServeMux` do Go 1.22+ (roteamento nativo por método+path, sem framework) |
| DI / IoC | nenhuma biblioteca — wiring manual em `module.go` por módulo |
| Acesso a dados | sqlc (SQL tipado, gerado) + pgx/v5 |
| Banco | PostgreSQL 16 |
| Migrations | goose, usado como biblioteca (`internal/platform/db`), não CLI global |
| Testes | `testing` da stdlib + build tags (`integration`) para separar unit de integração |
| Logs | `log/slog` (JSON) + `context.Context` para correlationId |
| Métricas | `prometheus/client_golang` (`GET /metrics`) |
| Tracing | OpenTelemetry Go SDK (OTLP → Tempo, ou stdout) |
| Containers | Docker multistage + Docker Compose (dev, test, observability) |
| CI | GitHub Actions: build → unit ∥ integration → coverage 80% |

Nomenclatura: pacotes em uma palavra minúscula, arquivos em `snake_case.go` — ver `docs/architecture-rules.md` para o resto.

---

## 2. Estrutura de pastas

```
cmd/
├── api/main.go        # bootstrap: config → logger → tracer → migrations → db pool → módulos → HTTP → shutdown
└── migrate/main.go    # go run ./cmd/migrate <up|down|status>, goose como lib
internal/
├── platform/
│   ├── config/        # leitura de env
│   ├── db/             # pgxpool.Pool + RunMigrations (goose)
│   ├── httperr/        # DomainError + mapa code→status HTTP
│   ├── httpserver/      # http.ServeMux + cadeia de middlewares
│   └── observability/   # slog, prometheus, otel, contexto (correlationId + ids de negócio)
└── modules/
    └── <módulo>/
        ├── domain/            # entity, value objects, erros do módulo
        ├── usecase/           # use-cases + ports.go (interfaces que eles consomem) + fakes de teste
        ├── adapters/
        │   ├── httpapi/       # handlers net/http + DTOs (domínio → JSON)
        │   └── postgres/      # implementação dos ports via sqlc + pgx
        └── module.go          # New(pool) monta adapter → use-case → handler; único arquivo que conhece os dois lados
db/
├── migrations/         # *.sql com marcadores -- +goose Up / -- +goose Down
├── schema/<módulo>/     # schema fonte para o sqlc inferir tipos (mantido em sincronia manual com migrations)
└── queries/<módulo>/    # queries anotadas (-- name: Query :one/:many/:exec) que o sqlc lê
sqlc.yaml               # aponta schema/queries → pacote gerado em adapters/postgres/sqlcgen
```

`internal/modules/example/` implementa todas as camadas: escrita (`POST /items` → 201), leitura paginada (`GET /items`), leitura por id com 404 (`GET /items/{itemId}`), VO simples (`item_name.go`), VO enum com máquina de estados (`item_status.go`), comportamento de entity (`Item.Archive()`), mapper Postgres, handler HTTP com teste via `httptest`. Copie o padrão; o roteiro de remoção está no passo 8 do `BOOTSTRAP-GO.md` do kit `_architecture`.

---

## 3. Regra de dependência (inviolável)

```
adapters/httpapi (handler) ──► usecase ──► domain
        │                        │
        │                        └──► interface definida em usecase/ports.go
        ▼                                       ▲
   DTO de resposta                               │ implementa
                              adapters/postgres ─┘
```

`module.go` é o único lugar que conhece `adapters/httpapi` E `adapters/postgres` ao mesmo tempo — todo o resto do módulo só vê a interface.

---

## 4. Erros: `(T, error)` em vez de `Either`

```
domain / VO   → New<X>(raw) (X, error)          // error é *httperr.DomainError
usecase       → Execute(ctx, input) (Output, error)
handler       → errors.As(err, &domainErr)?  sim → httperr.ToHTTP(domainErr) → 4xx/5xx
                                              não → 500 genérico (é bug/infra, não domínio)
```

Nenhuma exceção de domínio, `panic`/`recover` só existe no middleware de topo para não derrubar o processo num bug real.

- Status: validação de VO 422, não encontrado 404, conflito/transição inválida 409, forma do body 400 (`json.Decoder.DisallowUnknownFields()` rejeita campo desconhecido nativamente — não existe o equivalente do `removeAdditional` do Fastify para desligar).

---

## 5. Value Objects e Entities

- VO: `type X struct { value T }` (campo não exportado) + `func NewX(raw) (X, error)`.
- Enum: `type Status string` + consts + `ParseStatus(raw) (Status, error)` + `(s Status) TransitionTo(next Status) (Status, error)` quando houver máquina de estados.
- Entity: struct com campos não exportados, `func New<Entity>(...)  <Entity>` (novo) e `func Rehydrate<Entity>(...)  <Entity>` (reconstrução a partir do banco, só usada pelo mapper). Comportamento via método (`func (i *Item) Archive() error`), nunca mutação direta de campo de fora do pacote.
- Regra dependente de hora: `time.Now()` só dentro de `New<Entity>`/use-case, nunca dentro de uma regra testada isoladamente sem controle de tempo.

---

## 6. Testes

| Tipo | Arquivo | Como rodar | I/O | Dependências |
|---|---|---|---|---|
| Unit | `*_test.go` na mesma pasta | `go test ./...` | nenhum | fakes in-memory implementando a interface |
| Integration | `*_integration_test.go` + `//go:build integration` | `go test -tags=integration ./...` | Postgres real (`docker-compose.test.yml`, porta 5433) | `go run ./cmd/migrate up` antes |
| Coverage | ambos, escopo `internal/modules/...` | `scripts/check-coverage.sh` | ambos | threshold 80% |

Rotas HTTP são testadas com `httptest.NewServer` sobre o wiring real (`module.New(pool)` + `httpserver.New(mod)`), não apenas o handler isolado — é como se pega, por exemplo, um bug de middleware que só aparece com o servidor de pé.

Loop TDD: teste vermelho → interface do port se necessária → implementação mínima verde → refactor.

---

## 7. Observabilidade

- Middleware `withCorrelationID` (o mais externo da cadeia — ver `docs/architecture-rules.md` sobre por quê) lê `x-correlation-id` ou gera um, devolve no header, e chama `observability.WithCorrelationID(ctx, id)`.
- `observability.AddFields(ctx, map[string]string{...})` junta ids de negócio ao mesmo contexto; `observability.FromContext(ctx)` devolve um `*slog.Logger` já com `correlationId`, ids de negócio e `traceId`/`spanId` (se houver span ativo).
- Métricas de negócio declaradas em `internal/platform/observability/metrics.go`, registradas no `init()`.
- Fluxos assíncronos (fila, worker): propague o `context.Context` do zero ao fim do job; nunca `context.Background()` no meio de um fluxo que já tinha um `correlationId`.
- Stack local: `docker compose -f docker-compose.observability.yml up -d` → Grafana `:3001`, Prometheus `:9090`, Tempo `:3200`/`:4318`, Loki `:3100`.

---

## 8. Ambientes Docker

- `Dockerfile` multistage: `dev` (`go run ./cmd/api`, código bind-mounted), `build` (binário estático), `prod` (`gcr.io/distroless/static-debian12` — só o binário, sem shell, sem toolchain).
- `docker-compose.yml`: app + Postgres 16, sem Redis por padrão (o módulo `example` não usa cache; adicione o serviço quando um módulo real precisar).
- `docker-compose.test.yml`: Postgres isolado (porta 5433) para integration.
- `docker-compose.observability.yml`: Prometheus, Tempo, Loki, Promtail, Grafana provisionado (mesmo stack do kit TS).

---

## 9. sqlc: gerando o código de acesso a dados

1. Escreva/edite o schema em `db/schema/<módulo>/*.sql` **e** a migration correspondente em `db/migrations/NNNNN_*.sql` (os dois ficam em sincronia manual — sqlc não lê migrations neste setup).
2. Escreva as queries anotadas em `db/queries/<módulo>/*.sql` (`-- name: NomeDaQuery :one` / `:many` / `:exec`).
3. Rode `sqlc generate` (ou `make sqlc`) na raiz do projeto.
4. Commit o resultado em `internal/modules/<módulo>/adapters/postgres/sqlcgen/` — é código gerado, mas comitado (convenção do sqlc, diferente do cliente do Prisma no kit TS).
5. O adapter (`internal/modules/<módulo>/adapters/postgres/<nome>_repository.go`) usa o `sqlcgen.Queries` internamente e converte linha ↔ domínio no mapper — nunca expõe um tipo `sqlcgen.*` fora do pacote `adapters/postgres`.

Instalação do sqlc: `SETUP.md`. **Atenção Windows:** o binário `sqlc` para Windows usa um parser WASM (wazero) que pode falhar reservando memória em algumas configurações de 32 bits — se `sqlc generate` der panic de alocador, rode via WSL (`wsl sqlc generate`) ou baixe o binário `linux_amd64` e rode com `wsl /caminho/sqlc generate`.

---

## 10. Fluxo de desenvolvimento por sessão

Igual ao kit TS — só a lista de skills/agentes muda de "sabor":

| Fase | Ferramenta |
|---|---|
| Início de sessão | skill `session-start` |
| Feature nova / decisão arquitetural | `superpowers:brainstorming` → spec em `docs/superpowers/specs/AAAA-MM-DD-<tema>-design.md` |
| Plano de implementação | `superpowers:writing-plans` → `docs/superpowers/plans/AAAA-MM-DD-<tema>.md` |
| Execução do plano | `superpowers:subagent-driven-development` |
| Modelagem de entity/VO | skill `domain-modeler` |
| Implementação | agente `tdd-agent` |
| Observabilidade | skill `observability-enforcer` |
| Revisão de diff | agente `arch-reviewer` |
| Antes de fechar | `superpowers:verification-before-completion` |
| Integração | `superpowers:finishing-a-development-branch` → PR |

Todo prompt relevante vai para `prompts/NN-<tema>.md` (ver `prompts/CLAUDE.md`) e é indexado em `PROMPTS.md`. Decisões que não devem ser re-discutidas viram ADR em `docs/adr/NNNN-<titulo>.md`.
