# Architecture Rules — {{PROJECT_NAME}}

Review checklist referenced by `arch-reviewer`, `tdd-agent`, and `observability-enforcer`.
Go equivalent of the TypeScript kit's `src/shared/core/architecture-rules.md` — same principles, different idiomatic mechanism where the language requires it.

## Scope discipline

- Default to the simplest thing that works: a synchronous module, no cache, no queue, no outbox pattern.
- Before adding a cache, a queue/worker, an outbox pattern, or any other layer aimed at "large project" scale, **ask the user first** — see `CLAUDE.md`, "Scope discipline". This rule has no autonomous-mode exception.
- Observability (tracing/metrics/Grafana stack) is one of these opt-in layers too — see "Observability" below.

## Dependencies between layers

- `domain/` doesn't import anything from outside the module's own domain (only `internal/platform/httperr` and stdlib)
- `usecase/` only imports `domain/` from the same module and the interfaces (ports) it defines itself in `ports.go`
- `adapters/` implements interfaces — never imported by `usecase/` or `domain/`
- Modules don't import each other's `domain/` or `usecase/` directly
- Cross-module: only via an explicit interface defined in the consuming `usecase/`
- `module.go` is the only file in the module that imports `adapters/` — this is where the concretization happens
- HTTP handlers (`adapters/httpapi/`) only call a use-case, match on the error, and delegate to the response DTO

## Error handling

Go doesn't have `Either`; the native `(T, error)` pair fulfills the same role.

- Every use-case returns `(T, error)`; a domain failure is always a `*httperr.DomainError` (`internal/platform/httperr`)
- VO with validation: `New<Vo>(raw) (<Vo>, error)`
- The handler decides the status via `errors.As(err, &domainErr)`: success, response DTO; failure, `httperr.ToHTTP(domainErr)`
- No internal error (infra, bug) leaks detail to the client, it becomes a generic 500; the detail stays only in the log
- `DomainError.Code` in UPPER_SNAKE (e.g. `OUT_OF_STOCK`, `ITEM_NOT_FOUND`)
- Every new `Code` gets an entry in `internal/platform/httperr/error.go` (`statusByCode`), without an entry it falls through to 500
- Status: VO validation 422; resource not found 404; conflict/invalid transition 409; invalid body shape 400 (via `json.Decoder.DisallowUnknownFields()`, no schema library needed)
- Invariant enforced by the database (unique, FK) under concurrency: the Postgres adapter catches the driver error (`pgconn.PgError`, code `23505` etc.) and returns a `*httperr.DomainError`, never trust only "check then write". Pattern in `internal/modules/example/adapters/postgres/errors.go`
- Reference to a module that doesn't exist yet: store only the opaque id (string), no FK or validation; record it as an assumption and add validation via a port when the module exists
- Cache, queue, outbox pattern: not present by default (see "Scope discipline"). When added, they're ports too — define the interface in `usecase/ports.go` (or `internal/platform` if cross-module), same as any other adapter, and ask the user before starting

## Naming

- Packages in a single lowercase word, no underscore (`domain`, `usecase`, `httpapi`), never `use_cases` or `useCases`
- Files in `snake_case.go`
- Exported types in PascalCase, unexported in camelCase, same as TS, this doesn't change
- No `I` prefix on interfaces (deliberate difference from the TS kit): the port is `ItemRepository`, not `IItemRepository`, Go doesn't use Hungarian notation
- The interface is defined by whoever consumes it (`usecase/ports.go`), never by whoever implements it (`adapters/postgres`)
- Implementation prefixed by the technology when ambiguous: `postgres.ItemRepository`, `usecase.InMemoryItemRepository` (test fake)
- Domain enum: named string type + consts (`type ItemStatus string; const ItemStatusActive ItemStatus = "ACTIVE"`); in the database, a `TEXT` column, never a native Postgres enum, validation belongs to the domain, in the mapper

## Dependency injection

Go doesn't use a DI container. Wiring is manual and explicit.

- No `New<ConcreteAdapter>()` outside the module's `module.go`
- `module.go` assembles: `adapters/postgres.NewItemRepository(pool)` injects into `usecase.New<UseCase>(repo)` injects into `adapters/httpapi.ItemHandler`
- `cmd/api/main.go` only calls `<module>.New(pool)` per module and registers the routes, never constructs an adapter directly
- Build-time conformance check: `var _ usecase.ItemRepository = (*ItemRepository)(nil)` in the adapter, catches a mismatched signature at `go build`, not at runtime

## Tests

- Every entity, VO, and use-case has a `_test.go` in the same folder
- Unit tests: no real I/O, in-memory fakes implementing the interface (never a Postgres driver/HTTP mock)
- Integration tests: `_integration_test.go` suffix and `//go:build integration` at the top of the file, Go's mechanism for what the TS kit solves with a separate `vitest.integration.ts`
- Run unit only: `go test ./...` (build tag excludes integration by default)
- Run unit + integration: `go test -tags=integration ./...` (needs `docker-compose.test.yml` up and `go run ./cmd/migrate up` applied)
- Integration isolation: `TRUNCATE TABLE ...` at the start of each test (`testPool`/`testServer` helper)
- HTTP routes tested with `httptest.NewServer` + real wiring (`module.New(pool)` + `httpserver.New(mod)`), not just an isolated unit test of the handler
- Forbidden: tautological test (assertion recomputes the same value as the code)
- Forbidden: `_test.go` without a build tag hitting real Postgres/Redis
- Minimum coverage 80% over `internal/modules/...` (excludes `internal/platform/...`, `cmd/...` and sqlc-generated packages, see `scripts/check-coverage.sh`)

## Observability

Structured logging + correlationId are always on (cheap, framework-agnostic, useful at any project size). Tracing/metrics/Grafana are opt-in — decided at bootstrap (`BOOTSTRAP-GO.md`) or added later, on request.

If enabled:
- `correlationId` read from `x-correlation-id` or generated, propagated via `context.Context` (`internal/platform/observability`), never a global variable
- Structured logs via `log/slog` + `observability.FromContext(ctx)`, never `fmt.Println`/`log.Println` outside `cmd/`
- Business IDs added to the context with `observability.AddFields(ctx, map[string]string{...})` as soon as they exist
- Prometheus metrics in `internal/platform/observability/metrics.go`, exposed at `GET /metrics`
- OpenTelemetry spans on routes (via middleware) and critical use-cases (`observability.Tracer("<module>")`)
- Watch out for `r.WithContext`: it returns a copy of the request. Any middleware that needs to read something another middleware wrote (correlationId, `ServeMux`'s `r.Pattern`) only sees the change if it's "after" it in the chain, meaning the middleware that swaps the context must wrap all the others from the outside. Real bug found and fixed while building this kit: `withCorrelationID` must be the outermost middleware (see `internal/platform/httpserver/server.go`)

If declined: skip the metrics/tracing bullets above; `correlationId` + structured logging still apply.
</content>
