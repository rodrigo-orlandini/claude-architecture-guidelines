# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

Monolito modular com Clean Architecture em Go — ver [`docs/architecture.md`](./docs/architecture.md).

## Pré-requisitos

- Go 1.26+
- Docker + Docker Compose (nativo, ou via WSL no Windows — ver `go run ./scripts/compose -- ...` abaixo)
- [sqlc](https://docs.sqlc.dev/) — só para regenerar `internal/modules/*/adapters/postgres/sqlcgen` após mudar uma query/schema; não é necessário para rodar ou testar o projeto (o código gerado já vem commitado)

## Rodando

```bash
cp .env.example .env
go mod download
go run ./scripts/compose -- up -d postgres     # ou: go run ./scripts/compose -- up -d (também sobe o app em container)
go run ./cmd/migrate up                        # aplica migrations no banco de dev
go run ./cmd/api                                # ou: go run ./scripts/compose -- up app
```

- API: http://localhost:8080
- Health: http://localhost:8080/health
- Métricas: http://localhost:8080/metrics

## Testes

```bash
go build ./...
go vet ./...
gofmt -l .                              # deve voltar vazio
go test ./...                           # unit, sem I/O
go run ./scripts/compose -- -f docker-compose.test.yml up -d --wait
go run ./cmd/migrate up                 # contra o banco de teste (ver .env.example)
go test -tags=integration ./...         # unit + integration
```

Coverage combinado com threshold (80% sobre `internal/modules/...`):

```bash
PKGS=$(go list ./internal/modules/... | grep -v /sqlcgen)
go test -tags=integration -coverpkg=$(echo $PKGS | tr ' ' ',') -coverprofile=coverage.out $PKGS
bash scripts/check-coverage.sh 80 coverage.out
```

Ou, com `make` disponível: `make test-integration`, `make test-coverage`.

## Observabilidade

```bash
go run ./scripts/compose -- -f docker-compose.observability.yml up -d
```

Grafana em http://localhost:3001 (Prometheus, Loki e Tempo provisionados).

## Documentação

- [`CONTEXT.md`](./CONTEXT.md) — glossário de domínio
- [`docs/architecture.md`](./docs/architecture.md) — arquitetura e fluxo de desenvolvimento
- [`docs/architecture-rules.md`](./docs/architecture-rules.md) — regras de revisão
- [`PROMPTS.md`](./PROMPTS.md) — prompts de IA usados no desenvolvimento
