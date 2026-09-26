# {{PROJECT_NAME}}

Modular monolith with Clean Architecture in Go (native net/http + sqlc + pgx + Postgres).
Each module in `internal/modules/<module>/` is a bounded context extractable as a microservice without rework.

## Required reading before coding

- `CONTEXT.md` — domain glossary (entity names, modules, invariants)
- `docs/architecture-rules.md` — inviolable rules for layers, errors, manual DI, naming, tests, observability
- `docs/architecture.md` — full structure design
- Reference module: `internal/modules/example/` while it exists; after it's removed, the most complete real module in `internal/modules/` — copy its pattern

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

Steps that require approval (brainstorming, domain-modeler, plans) require a response from the user. In autonomous execution, with no one to respond: decide on the simplest option compatible with `CONTEXT.md`, record each decision in an **Assumptions** section of the spec, and proceed; never invent a new requirement.

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
- `go run ./scripts/compose -- -f docker-compose.observability.yml up -d` — Prometheus, Grafana, Loki, Tempo
- `make <target>` — shortcuts for the commands above via `Makefile`, if `make` is available (optional; every target has the equivalent `go`/`docker` command documented above)
</content>
