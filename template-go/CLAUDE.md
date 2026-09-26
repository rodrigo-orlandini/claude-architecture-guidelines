# {{PROJECT_NAME}}

Modular monolith with Clean Architecture in Go (native net/http + sqlc + pgx + Postgres).
Each module in `internal/modules/<module>/` is a bounded context extractable as a microservice without rework.

## Required reading before coding

- `CONTEXT.md` — domain glossary (entity names, modules, invariants)
- `docs/architecture-rules.md` — inviolable rules for layers, errors, manual DI, naming, tests, observability
- `docs/architecture.md` — full structure design
- Reference module: `internal/modules/example/` while it exists; after it's removed, the most complete real module in `internal/modules/` — copy its pattern

## Scope discipline

This kit scales from a small CRUD service to a complex system — it doesn't assume every project needs every layer. Default to the simplest thing that works:

- One synchronous module, no cache, no queue, no outbox pattern — until a feature genuinely needs one.
- Before introducing a cache (Redis or otherwise), a queue/worker, an outbox pattern, or any other "large-project" layer, **ask the user first**. Don't add it because the reference project once had it, or because it seems like good practice for a "real" system — add it when the feature at hand actually requires it and the user confirms.
- Observability is one of these opt-in layers too — see "Observability" below for what ships by default and what was asked about at bootstrap.

## Development flow

Start of session: invoke the `session-start` skill.

```
brainstorming (superpowers) → spec in docs/superpowers/specs/
  → writing-plans → plan in docs/superpowers/plans/
  → domain-modeler (entities / VOs)
  → tdd-agent (red → green → refactor per use-case)
  → observability-enforcer
  → arch-reviewer (diff)
  → verification-before-completion
  → commit + PR
```

Steps that require approval (brainstorming, domain-modeler, plans) require a response from the user. In autonomous execution, with no one to respond: decide on the simplest option compatible with `CONTEXT.md`, record each decision in an **Assumptions** section of the spec, and proceed; never invent a new requirement. This does not apply to the scope-discipline layers above — those get asked about regardless of execution mode.

## Observability

Structured logging (`log/slog`) + correlationId propagation are always on — cheap, and useful in any project regardless of size. Full telemetry (OpenTelemetry tracing, Prometheus metrics, the Grafana/Loki/Tempo stack) is opt-in, decided at bootstrap time (see `BOOTSTRAP-GO.md`). If it was declined for this project:
- `internal/platform/observability/tracer.go`, `metrics.go` and the `GET /metrics` route don't exist here
- `docker-compose.observability.yml`, `grafana/`, `prometheus.yml` don't exist here
- the `observability-enforcer` skill's metrics/tracing checklist items don't apply — only its logging/correlationId section does

If those files/folders DO exist in this project, full telemetry is on — keep instrumenting new use-cases the same way `usecase/create_item.go` does.

## Git

- Every new task: new branch from `origin/main` (`feat/<name>`, `fix/<name>`, `docs/<name>`).
- Commits in Conventional Commits (`feat(module): ...`, `fix(module): ...`).
- Task completion: open a PR to `main` (`gh pr create`). CI must pass (build → unit + integration → coverage 80%).

## Prompts

Save every relevant prompt in `prompts/`. See `prompts/CLAUDE.md` for naming convention and structure. Update the index in `PROMPTS.md`.

## Commands

- `go build ./...` — builds everything
- `go vet ./...` / `gofmt -l .` — lint (no external tool; golangci-lint is optional, see SETUP.md)
- `go test ./...` — unit (no I/O)
- `go run ./cmd/migrate up` — applies migrations to the database pointed to by `DATABASE_URL`
- `go test -tags=integration ./...` — runs against `docker-compose.test.yml` (run `go run ./cmd/migrate up` first)
- `bash scripts/check-coverage.sh 80 coverage.out` — checks the threshold over `internal/modules/...`
- `go run ./cmd/api` — starts the API locally
- `go run ./scripts/compose -- <args>` — portable `docker compose`; automatically uses `wsl docker compose` on Windows without Docker Desktop (doesn't need Node, only the already-required Go toolchain)
- `go run ./scripts/compose -- up -d postgres` — starts only the dev Postgres
- `go run ./scripts/compose -- -f docker-compose.observability.yml up -d` — Prometheus, Grafana, Loki, Tempo (only if observability was enabled at bootstrap)
- `make <target>` — shortcuts for the commands above via `Makefile`, if `make` is available (optional; every target has the equivalent `go`/`docker` command documented above)
</content>
