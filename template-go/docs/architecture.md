# Architecture — {{PROJECT_NAME}}

Modular monolith with Clean Architecture, in Go. Same philosophy as the TypeScript kit (single repository, each module a bounded context extractable as a microservice without rework), different idiomatic mechanism where the language calls for it.

Review rules (short checklist): `docs/architecture-rules.md`.
Domain glossary: `CONTEXT.md`.

This kit scales from a small CRUD service to a complex system. The reference module doesn't use a cache, a queue, or an outbox pattern — those (and full telemetry) are opt-in layers, added when a feature genuinely needs them, only after asking the user. See "Scope discipline" in `CLAUDE.md`.

---

## 1. Stack

| Layer | Technology |
|---|---|
| Runtime | Go 1.26+ |
| HTTP | pure `net/http` — Go 1.22+'s `http.ServeMux` (native method+path routing, no framework) |
| DI / IoC | no library — manual wiring in each module's `module.go` |
| Data access | sqlc (typed, generated SQL) + pgx/v5 |
| Database | PostgreSQL 16 |
| Migrations | goose, used as a library (`internal/platform/db`), not a global CLI |
| Tests | stdlib `testing` + build tags (`integration`) to separate unit from integration |
| Logs | `log/slog` (JSON) + `context.Context` for correlationId — always on |
| Cache / queues | not used by the reference module — added only when a real feature needs them (ask first, see "Scope discipline"); no Redis provisioned by default |
| Metrics | `prometheus/client_golang` (`GET /metrics`) — opt-in, see §7 |
| Tracing | OpenTelemetry Go SDK (OTLP → Tempo, or stdout) — opt-in, see §7 |
| Containers | Docker multistage + Docker Compose (dev, test, observability) |
| CI | GitHub Actions: build → unit ∥ integration → coverage 80% |

Naming: packages in a single lowercase word, files in `snake_case.go` — see `docs/architecture-rules.md` for the rest.

---

## 2. Folder structure

```
cmd/
├── api/main.go        # bootstrap: config → logger → tracer → migrations → db pool → modules → HTTP → shutdown
└── migrate/main.go    # go run ./cmd/migrate <up|down|status>, goose as a lib
internal/
├── platform/
│   ├── config/        # env reading
│   ├── db/             # pgxpool.Pool + RunMigrations (goose)
│   ├── httperr/        # DomainError + code→HTTP status map
│   ├── httpserver/      # http.ServeMux + middleware chain
│   └── observability/   # slog + context always present; metrics.go/tracer.go only if telemetry enabled — see §7
└── modules/
    └── <module>/
        ├── domain/            # entity, value objects, module errors
        ├── usecase/           # use-cases + ports.go (interfaces they consume) + test fakes
        ├── adapters/
        │   ├── httpapi/       # net/http handlers + DTOs (domain → JSON)
        │   └── postgres/      # port implementations via sqlc + pgx
        └── module.go          # New(pool) assembles adapter → use-case → handler; the only file that knows both sides
db/
├── migrations/         # *.sql with -- +goose Up / -- +goose Down markers
├── schema/<module>/     # source schema for sqlc to infer types (kept in manual sync with migrations)
└── queries/<module>/    # annotated queries (-- name: QueryName :one/:many/:exec) that sqlc reads
sqlc.yaml               # points schema/queries → package generated in adapters/postgres/sqlcgen
```

`internal/modules/example/` implements all layers: write (`POST /items` → 201), paginated read (`GET /items`), read by id with 404 (`GET /items/{itemId}`), simple VO (`item_name.go`), enum VO with a state machine (`item_status.go`), entity behavior (`Item.Archive()`), Postgres mapper, HTTP handler with a test via `httptest`. Copy the pattern; the removal steps are in step 8 of the `_architecture` kit's `BOOTSTRAP-GO.md`.

---

## 3. Dependency rule (inviolable)

```
adapters/httpapi (handler) ──► usecase ──► domain
        │                        │
        │                        └──► interface defined in usecase/ports.go
        ▼                                       ▲
   response DTO                                  │ implements
                              adapters/postgres ─┘
```

`module.go` is the only place that knows both `adapters/httpapi` AND `adapters/postgres` at the same time — everything else in the module only sees the interface.

---

## 4. Errors: `(T, error)` instead of `Either`

```
domain / VO   → New<X>(raw) (X, error)          // error is *httperr.DomainError
usecase       → Execute(ctx, input) (Output, error)
handler       → errors.As(err, &domainErr)?  yes → httperr.ToHTTP(domainErr) → 4xx/5xx
                                              no  → generic 500 (it's a bug/infra, not domain)
```

No domain exceptions, `panic`/`recover` only exists in the top-level middleware to avoid crashing the process on a real bug.

- Status: VO validation 422, not found 404, conflict/invalid transition 409, invalid body shape 400 (`json.Decoder.DisallowUnknownFields()` natively rejects an unknown field — there's no equivalent of Fastify's `removeAdditional` to turn off).

---

## 5. Value Objects and Entities

- VO: `type X struct { value T }` (unexported field) + `func NewX(raw) (X, error)`.
- Enum: `type Status string` + consts + `ParseStatus(raw) (Status, error)` + `(s Status) TransitionTo(next Status) (Status, error)` when there's a state machine.
- Entity: struct with unexported fields, `func New<Entity>(...) <Entity>` (new) and `func Rehydrate<Entity>(...) <Entity>` (reconstruction from the database, only used by the mapper). Behavior via method (`func (i *Item) Archive() error`), never direct field mutation from outside the package.
- Time-dependent rule: `time.Now()` only inside `New<Entity>`/use-case, never inside a rule tested in isolation without time control.

---

## 6. Tests

| Type | File | How to run | I/O | Dependencies |
|---|---|---|---|---|
| Unit | `*_test.go` in the same folder | `go test ./...` | none | in-memory fakes implementing the interface |
| Integration | `*_integration_test.go` + `//go:build integration` | `go test -tags=integration ./...` | real Postgres (`docker-compose.test.yml`, port 5433) | `go run ./cmd/migrate up` beforehand |
| Coverage | both, scoped to `internal/modules/...` | `scripts/check-coverage.sh` | both | 80% threshold |

HTTP routes are tested with `httptest.NewServer` over the real wiring (`module.New(pool)` + `httpserver.New(mod)`), not just the isolated handler — this is how you catch, for example, a middleware bug that only shows up with the server actually up.

TDD loop: red test → port interface if needed → minimal green implementation → refactor.

---

## 7. Observability (opt-in)

Decided once, at bootstrap (`BOOTSTRAP-GO.md`), by asking the user. Can also be added later, on request, following the same shape below.

**Always on, regardless of the answer:** structured logging (`log/slog`) + correlationId. Cheap, and useful at any project size — not considered "telemetry" for this decision.

**Only if enabled:**
- The `withCorrelationID` middleware (the outermost in the chain — see `docs/architecture-rules.md` for why) reads `x-correlation-id` or generates one, returns it in the header, and calls `observability.WithCorrelationID(ctx, id)`.
- `observability.AddFields(ctx, map[string]string{...})` adds business ids to the same context; `observability.FromContext(ctx)` returns a `*slog.Logger` already carrying `correlationId`, business ids, and `traceId`/`spanId` (if there's an active span).
- Business metrics declared in `internal/platform/observability/metrics.go`, registered in `init()`.
- Async flows (queue, worker): propagate the `context.Context` from start to end of the job; never `context.Background()` in the middle of a flow that already had a `correlationId`.
- Local stack: `docker compose -f docker-compose.observability.yml up -d` → Grafana `:3001`, Prometheus `:9090`, Tempo `:3200`/`:4318`, Loki `:3100`.

**If declined:** none of `internal/platform/observability/{metrics,tracer}.go`, `withMetrics`/span creation in `middleware.go`, `docker-compose.observability.yml`, or `grafana/` exist in this project. `context.go` + the correlationId part of the middleware still do.

---

## 8. Docker environments

- Multistage `Dockerfile`: `dev` (`go run ./cmd/api`, bind-mounted code), `build` (static binary), `prod` (`gcr.io/distroless/static-debian12` — just the binary, no shell, no toolchain).
- `docker-compose.yml`: app + Postgres 16, no Redis by default (the `example` module doesn't use cache; add the service when a real module needs it).
- `docker-compose.test.yml`: isolated Postgres (port 5433) for integration.
- `docker-compose.observability.yml` + `grafana/`: only present if observability was enabled (§7); same stack as the TS kit.

---

## 9. sqlc: generating data access code

1. Write/edit the schema in `db/schema/<module>/*.sql` **and** the corresponding migration in `db/migrations/NNNNN_*.sql` (the two stay in manual sync — sqlc doesn't read migrations in this setup).
2. Write the annotated queries in `db/queries/<module>/*.sql` (`-- name: QueryName :one` / `:many` / `:exec`).
3. Run `sqlc generate` (or `make sqlc`) at the project root.
4. Commit the result to `internal/modules/<module>/adapters/postgres/sqlcgen/` — it's generated code, but committed (sqlc convention, unlike the Prisma client in the TS kit).
5. The adapter (`internal/modules/<module>/adapters/postgres/<name>_repository.go`) uses `sqlcgen.Queries` internally and converts row ↔ domain in the mapper — never exposes a `sqlcgen.*` type outside the `adapters/postgres` package.

sqlc installation: `SETUP.md`. **Windows note:** the `sqlc` binary for Windows uses a WASM parser (wazero) that can fail to reserve memory on some 32-bit configurations — if `sqlc generate` panics on allocation, run it via WSL (`wsl sqlc generate`) or download the `linux_amd64` binary and run it with `wsl /path/sqlc generate`.

---

## 10. Development flow per session

Same as the TS kit — only the list of skills/agents changes "flavor":

| Phase | Tool |
|---|---|
| Start of session | `session-start` skill |
| New feature / architectural decision | `superpowers:brainstorming` → spec in `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` |
| Implementation plan | `superpowers:writing-plans` → `docs/superpowers/plans/YYYY-MM-DD-<topic>.md` |
| Plan execution | `superpowers:subagent-driven-development` |
| Entity/VO modeling | `domain-modeler` skill |
| Implementation | `tdd-agent` agent |
| Observability | `observability-enforcer` skill (only if enabled, §7) |
| Diff review | `arch-reviewer` agent |
| Before closing | `superpowers:verification-before-completion` |
| Integration | `superpowers:finishing-a-development-branch` → PR |

Bootstrap only scaffolds and validates — it does not run this loop automatically. See `BOOTSTRAP-GO.md`.

Every relevant prompt goes to `prompts/NN-<topic>.md` (see `prompts/CLAUDE.md`) and is indexed in `PROMPTS.md`. Decisions that shouldn't be re-discussed become an ADR in `docs/adr/NNNN-<title>.md`.
</content>
