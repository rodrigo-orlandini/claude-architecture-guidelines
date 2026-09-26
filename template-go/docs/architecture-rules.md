# Regras de Arquitetura — {{PROJECT_NAME}}

Checklist de revisão referenciado por `arch-reviewer`, `tdd-agent` e `observability-enforcer`.
Equivalente Go do `src/shared/core/architecture-rules.md` do kit TypeScript — mesmos princípios, mecanismo idiomático diferente onde a linguagem exige.

## Dependências entre camadas

- `domain/` não importa nada de fora do próprio domínio do módulo (só `internal/platform/httperr` e stdlib)
- `usecase/` importa apenas `domain/` do mesmo módulo e as interfaces (ports) que ele mesmo define em `ports.go`
- `adapters/` implementa interfaces — nunca é importado por `usecase/` ou `domain/`
- Módulos não importam `domain/` ou `usecase/` uns dos outros diretamente
- Cross-module: apenas via interface explícita definida no `usecase/` consumidor
- `module.go` é o único arquivo do módulo que importa `adapters/` — é onde a concretização acontece
- Handlers HTTP (`adapters/httpapi/`) só chamam um use-case, fazem match no erro e delegam ao DTO de resposta

## Tratamento de erros

Go não tem `Either`; o par nativo `(T, error)` cumpre o mesmo papel.

- Todo use-case retorna `(T, error)`; falha de domínio é sempre um `*httperr.DomainError` (`internal/platform/httperr`)
- VO com validação: `New<Vo>(raw) (<Vo>, error)`
- Handler decide o status via `errors.As(err, &domainErr)`: sucesso, DTO de resposta; falha, `httperr.ToHTTP(domainErr)`
- Nenhum erro interno (infra, bug) vaza detalhe ao cliente, vira 500 genérico; o detalhe fica só no log
- `DomainError.Code` em UPPER_SNAKE (ex: `OUT_OF_STOCK`, `ITEM_NOT_FOUND`)
- Todo `Code` novo ganha entrada em `internal/platform/httperr/error.go` (`statusByCode`), sem entrada cai em 500
- Status: validação de VO 422; recurso inexistente 404; conflito/transição inválida 409; forma do body inválida 400 (via `json.Decoder.DisallowUnknownFields()`, não precisa de biblioteca de schema)
- Invariante garantida pelo banco (unique, FK) sob concorrência: o adapter Postgres captura o erro do driver (`pgconn.PgError`, código `23505` etc.) e retorna um `*httperr.DomainError`, nunca confie só em "consultar antes de gravar". Padrão em `internal/modules/example/adapters/postgres/errors.go`
- Referência a módulo que ainda não existe: guarde só o id opaco (string), sem FK nem validação; registre como premissa e adicione a validação via port quando o módulo existir

## Nomenclatura

- Pacotes em uma palavra minúscula, sem underscore (`domain`, `usecase`, `httpapi`), nunca `use_cases` ou `useCases`
- Arquivos em `snake_case.go`
- Tipos exportados em PascalCase, não exportados em camelCase, igual TS, isso não muda
- Sem prefixo `I` em interface (diferença deliberada do kit TS): a porta é `ItemRepository`, não `IItemRepository`, Go não usa Hungarian notation
- A interface é definida por quem consome (`usecase/ports.go`), nunca por quem implementa (`adapters/postgres`)
- Implementação prefixada pela tecnologia quando ambíguo: `postgres.ItemRepository`, `usecase.InMemoryItemRepository` (fake de teste)
- Enum de domínio: named string type + consts (`type ItemStatus string; const ItemStatusActive ItemStatus = "ACTIVE"`); no banco, coluna `TEXT`, nunca um enum nativo do Postgres, a validação é do domínio, no mapper

## Injeção de dependência

Go não usa container de DI. Wiring é manual e explícito.

- Nenhum `New<Adapter>Concreto()` fora de `module.go` do módulo
- `module.go` monta: `adapters/postgres.NewItemRepository(pool)` injeta no `usecase.New<UseCase>(repo)` injeta no `adapters/httpapi.ItemHandler`
- `cmd/api/main.go` só chama `<módulo>.New(pool)` por módulo e registra as rotas, nunca constrói um adapter diretamente
- Cheque de conformidade em tempo de build: `var _ usecase.ItemRepository = (*ItemRepository)(nil)` no adapter, pega assinatura desalinhada no `go build`, não em runtime

## Testes

- Toda entity, VO e use-case tem `_test.go` na mesma pasta
- Unit tests: sem I/O real, fakes in-memory implementando a interface (nunca mock de driver Postgres/HTTP)
- Integration tests: sufixo `_integration_test.go` e `//go:build integration` no topo do arquivo, mecanismo do Go para o que o kit TS resolve com `vitest.integration.ts` separado
- Rodar só unit: `go test ./...` (build tag exclui integration por padrão)
- Rodar unit + integration: `go test -tags=integration ./...` (precisa de `docker-compose.test.yml` de pé e `go run ./cmd/migrate up` aplicado)
- Isolamento de integration: `TRUNCATE TABLE ...` no início de cada teste (helper `testPool`/`testServer`)
- Rotas HTTP testadas com `httptest.NewServer` + wiring real (`module.New(pool)` + `httpserver.New(mod)`), não só unit test do handler isolado
- Proibido: teste tautológico (assertion recomputa o valor igual ao código)
- Proibido: `_test.go` sem build tag batendo em Postgres/Redis real
- Coverage mínimo 80% sobre `internal/modules/...` (exclui `internal/platform/...`, `cmd/...` e pacotes gerados por sqlc, ver `scripts/check-coverage.sh`)

## Observabilidade

- `correlationId` lido de `x-correlation-id` ou gerado, propagado via `context.Context` (`internal/platform/observability`), nunca uma variável global
- Logs estruturados via `log/slog` + `observability.FromContext(ctx)`, nunca `fmt.Println`/`log.Println` fora de `cmd/`
- IDs de negócio adicionados ao contexto com `observability.AddFields(ctx, map[string]string{...})` assim que existirem
- Métricas Prometheus em `internal/platform/observability/metrics.go`, expostas em `GET /metrics`
- Spans OpenTelemetry em rotas (via middleware) e use-cases críticos (`observability.Tracer("<módulo>")`)
- Cuidado com `r.WithContext`: retorna uma cópia do request. Qualquer middleware que precise ler algo que outro middleware escreveu (correlationId, `r.Pattern` do `ServeMux`) só enxerga a mudança se estiver "depois" na cadeia, ou seja, o middleware que troca o contexto deve envolver todos os outros por fora. Bug real encontrado e corrigido durante a criação deste kit: `withCorrelationID` precisa ser o middleware mais externo (ver `internal/platform/httpserver/server.go`)
