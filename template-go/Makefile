# Convenience wrapper around plain `go` commands — nothing here is required.
# On a machine without `make` (e.g. plain Windows, no Git Bash/WSL make),
# run the commands under each target directly; see README.md.

MODULE_PKGS := $(shell go list ./internal/modules/... | grep -v /sqlcgen)

.PHONY: dev build test test-integration test-coverage lint fmt migrate-up migrate-status sqlc infra-up observability-up

dev:
	go run ./cmd/api

build:
	go build -o bin/api ./cmd/api
	go build -o bin/migrate ./cmd/migrate

test:
	go test ./...

# Brings up docker-compose.test.yml (native docker or, on Windows without
# Docker Desktop, via WSL — see scripts/compose), applies migrations, then
# runs unit + integration. Build tag `integration` is Go's equivalent of the
# TS kit's separate vitest.integration.ts config.
test-integration:
	go run ./scripts/compose -- -f docker-compose.test.yml up -d --wait
	DATABASE_URL=$${TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/{{project_db}}_test?sslmode=disable} go run ./cmd/migrate up
	go test -tags=integration ./...

test-coverage:
	go run ./scripts/compose -- -f docker-compose.test.yml up -d --wait
	DATABASE_URL=$${TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/{{project_db}}_test?sslmode=disable} go run ./cmd/migrate up
	go test -tags=integration -coverpkg=$(shell echo $(MODULE_PKGS) | tr ' ' ',') \
		-coverprofile=coverage.out $(MODULE_PKGS)
	./scripts/check-coverage.sh 80 coverage.out

infra-up:
	go run ./scripts/compose -- up -d postgres

observability-up:
	go run ./scripts/compose -- -f docker-compose.observability.yml up -d

lint:
	go vet ./...
	gofmt -l . | (! grep .)
# golangci-lint (optional, see SETUP.md): golangci-lint run

fmt:
	gofmt -w .

migrate-up:
	go run ./cmd/migrate up

migrate-status:
	go run ./cmd/migrate status

# Regenerates internal/modules/*/adapters/postgres/sqlcgen from
# db/schema + db/queries. Requires the sqlc CLI (see SETUP.md) — commit the
# generated output, same as the TS kit expects a Prisma client to exist.
sqlc:
	sqlc generate
