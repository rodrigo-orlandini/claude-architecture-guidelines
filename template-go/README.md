# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

Modular monolith with Clean Architecture in Go — see [`docs/architecture.md`](./docs/architecture.md).

## Prerequisites

- Go 1.26+
- Docker + Docker Compose (native, or via WSL on Windows — see `go run ./scripts/compose -- ...` below)
- [sqlc](https://docs.sqlc.dev/) — only needed to regenerate `internal/modules/*/adapters/postgres/sqlcgen` after changing a query/schema; not required to run or test the project (the generated code is already committed)

## Running

```bash
cp .env.example .env
go mod download
go run ./scripts/compose -- up -d postgres     # or: go run ./scripts/compose -- up -d (also starts the app in a container)
go run ./cmd/migrate up                        # applies migrations to the dev database
go run ./cmd/api                                # or: go run ./scripts/compose -- up app
```

- API: http://localhost:8080
- Health: http://localhost:8080/health
- Metrics: http://localhost:8080/metrics

## Tests

```bash
go build ./...
go vet ./...
gofmt -l .                              # should return empty
go test ./...                           # unit, no I/O
go run ./scripts/compose -- -f docker-compose.test.yml up -d --wait
go run ./cmd/migrate up                 # against the test database (see .env.example)
go test -tags=integration ./...         # unit + integration
```

Combined coverage with threshold (80% over `internal/modules/...`):

```bash
PKGS=$(go list ./internal/modules/... | grep -v /sqlcgen)
go test -tags=integration -coverpkg=$(echo $PKGS | tr ' ' ',') -coverprofile=coverage.out $PKGS
bash scripts/check-coverage.sh 80 coverage.out
```

Or, with `make` available: `make test-integration`, `make test-coverage`.

## Observability

```bash
go run ./scripts/compose -- -f docker-compose.observability.yml up -d
```

Grafana at http://localhost:3001 (Prometheus, Loki, and Tempo provisioned).

## Documentation

- [`CONTEXT.md`](./CONTEXT.md) — domain glossary
- [`docs/architecture.md`](./docs/architecture.md) — architecture and development flow
- [`docs/architecture-rules.md`](./docs/architecture-rules.md) — review rules
- [`PROMPTS.md`](./PROMPTS.md) — AI prompts used during development
</content>
