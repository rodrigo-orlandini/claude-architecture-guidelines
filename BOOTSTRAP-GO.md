# BOOTSTRAP-GO — apply the Go structure to a new project

> Go stack (native net/http + sqlc + pgx + Postgres). For TypeScript, use `BOOTSTRAP-TS.md`.

Executable playbook. Written for an AI agent with no prior context, but anyone can follow it.

- `$KIT` = the folder this file is in (the `_architecture/` folder whose path was given in the prompt).
- `$DEST` = the new project's root = the current working directory.

Inputs (ask the user if missing; in autonomous execution, derive them):
- **Readable name** → `{{PROJECT_NAME}}` (e.g. `Clinic Booking`)
- **kebab-case slug** → `{{project-slug}}` (e.g. `clinic-booking`; derive from the name)
- **snake_case database name** → `{{project_db}}` (e.g. `clinic_booking`; slug with `-` swapped for `_`)
- **Go module path** → `{{module-path}}` (e.g. `github.com/acme/clinic-booking`; ask for the org/account, or use `github.com/<git-username>/<slug>` if there's no preference)
- **Domain description** (1–3 sentences) — used in step 7; the first sentence becomes `{{PROJECT_DESCRIPTION}}` (the project's README)

**Autonomous mode** (no one available to answer questions or approve): at every point that asks for a user response/approval, pick the simplest option compatible with the domain description, record the decision in an **Assumptions** section of the spec (step 7), and proceed. Never invent a requirement the description doesn't suggest.

---

## Step 0 — Prerequisites

Check `$KIT/SETUP.md` §1–2. Minimum: `go version` (≥ 1.26, `amd64` architecture — check with `go env GOARCH`), `git --version`. Docker is only needed for `go test -tags=integration` and containerized dev; without it, build/vet/unit tests still work. `sqlc` is only needed if you're changing a schema/query (the generated code already comes committed in the template).

## Step 1 — Check the destination

- If `$DEST` already has `go.mod`, `internal/`, or `.claude/`, **stop and ask** before overwriting. This kit is for a new project; for an existing one, merge file by file manually.
- Empty folder, or with just `.git`/README: proceed.

## Step 2 — Copy the template

Copy **all** of `$KIT/template-go/`'s contents, including dotfiles (`.claude/`, `.github/`, `.env.example`, `.gitignore`):

```bash
cp -r "$KIT/template-go/." "$DEST/"
```

Don't copy `$KIT/reference/` or the root kit's `.md` files.

## Step 3 — Substitute placeholders

In every copied file (including `.claude/`, `.github/`, `grafana/`, and **the `.go` files — the placeholder lives inside the import path's string literal, it's syntactically valid until it's replaced**). On Windows, run this in Git Bash:

```bash
grep -rl --exclude-dir=.git -e '{{module-path}}' -e '{{PROJECT_NAME}}' -e '{{project-slug}}' -e '{{project_db}}' -e '{{PROJECT_DESCRIPTION}}' . \
  | xargs sed -i -e 's#{{module-path}}#github.com/acme/clinic-booking#g' \
                 -e 's/{{PROJECT_NAME}}/Clinic Booking/g' \
                 -e 's/{{project-slug}}/clinic-booking/g' \
                 -e 's/{{project_db}}/clinic_booking/g' \
                 -e 's/{{PROJECT_DESCRIPTION}}/API for small clinics to schedule appointments./g'
```

Adjust the example values above to the real ones. If the description has `/` or `&`, escape them in `sed` or edit `README.md` by hand.

**`{{route}}`** in `grafana/provisioning/dashboards/app.json` (if present) is Grafana syntax — not a kit placeholder, don't substitute it.

Verify: `grep -rn '{{PROJECT_NAME}}\|{{project-slug}}\|{{project_db}}\|{{module-path}}\|{{PROJECT_DESCRIPTION}}' .` should come back empty.

## Step 4 — Dependencies

```bash
cp .env.example .env
go mod download
go build ./...
```

If `go mod download`/`go build` complains about a checksum, run `go mod tidy` once (re-downloads and re-resolves everything with `{{module-path}}` already substituted) and check that `go.sum` didn't change unexpectedly.

## Step 5 — Validate the template (before changing anything)

```bash
go build ./...
go vet ./...
test -z "$(gofmt -l .)"
go test ./...
```

All of these must pass. With Docker available, also:

```bash
go run ./scripts/compose -- -f docker-compose.test.yml up -d --wait
go run ./cmd/migrate up          # DATABASE_URL must point at the test database — see .env.example / TEST_DATABASE_URL
go test -tags=integration ./...
```

If something fails because of a kit defect, fix it in the project and **tell the user** which kit file needed the adjustment.

## Step 6 — Initial commit

```bash
git init -b main          # if not already a repository
git add .
git commit -m "chore: bootstrap modular monolith architecture (go)"
```

Don't push or create a remote repository unless the user asks (`SETUP.md` §5).

## Step 7 — Domain

With the user present: invoke `superpowers:brainstorming` with the domain description.
Autonomous mode: don't invoke the skill (it depends on Q&A); do the short version below yourself.

Define:
- modules (bounded contexts) and each one's responsibility
- entities, value objects, and invariants
- main flows (endpoints)
- which module to implement first (the domain's most central one)

Deliverables:
1. Filled-in `CONTEXT.md`: replace the example lines, keep the sections. The lines marked "(example)" from the `example` module go away in step 8.
2. Spec at `docs/superpowers/specs/YYYY-MM-DD-initial-domain-design.md` with: context, modules, entities/VOs/invariants, endpoints, **Assumptions** (decisions made without confirmation), out of scope.
3. `prompts/00-estrutura-arquitetural.md`: **Prompt** section = the exact text that started this bootstrap; **Result** section = what's been generated so far (finish it in step 9).
4. `prompts/01-initial-domain.md` in the same format, recording the domain brainstorming.
5. `PROMPTS.md`: add the 01 line to the index.
6. Commit: `docs: domain model and initial spec`.

Reference of a real filled-in project (TS kit, same process): `$KIT/reference/reference-project/`.

## Step 8 — First real module, and removing `example`

Implement **only the first module** now (the rest follow the normal feature flow, one per branch). Start on a branch: `git switch -c feat/<module>` (there's no `origin/main` yet; branch off the local `main`).

If the central module depends on modules that don't exist yet (e.g. appointment → patient), store only the opaque id (string, no FK, no validation) and record it as an assumption — see `docs/architecture-rules.md`, "Error handling" section.

Mirror `internal/modules/example/`: same packages, patterns, and test types. Reference files as needed:

| Need | Copy the pattern from |
|---|---|
| Simple VO with validation | `domain/item_name.go` |
| Enum / state machine | `domain/item_status.go` + `Item.Archive()` in `domain/item.go` |
| Creation (POST, 201, body rejecting an unknown field) | `usecase/create_item.go` + `adapters/httpapi/item_handler.go` (`json.Decoder.DisallowUnknownFields()`) |
| Read by id with 404 | `usecase/get_item.go` + `domain/errors.go` |
| Paginated listing | `usecase/list_items.go` |
| Persistence | `db/schema/example/`, `db/queries/example/`, `sqlc.yaml` (add an entry), `adapters/postgres/item_repository.go` + `mapper.go` (+ integration test) |
| Migration | `db/migrations/NNNNN_<name>.sql` with `-- +goose Up` / `-- +goose Down` markers |
| Wiring | `module.go` (the only file that knows both `adapters/httpapi` and `adapters/postgres`) |
| HTTP test (status, DTO, 400 for extra field) | `adapters/httpapi/item_handler_integration_test.go` (`httptest.NewServer` + real wiring) |
| Business id in logs | `observability.AddFields` in `usecase/create_item.go` |
| Invariant enforced by the database under concurrency | `adapters/postgres/errors.go` (`isUniqueViolation` comment) |

After writing new schema/queries, run `sqlc generate` (or `make sqlc`) and commit the result in `adapters/postgres/sqlcgen/`.

New module checklist:
- [ ] Model in `db/schema/<module>/` **and** a matching migration in `db/migrations/` (the two kept in sync by hand)
- [ ] New error codes in `internal/platform/httperr/error.go` (`statusByCode`)
- [ ] Metrics in `internal/platform/observability/metrics.go` (`<module>_*`, registered in `init()`)
- [ ] `<module>.New(pool)` called in `cmd/api/main.go`; routes registered via `httpserver.New(...)`
- [ ] Tests: VO, entity, use-cases (in-memory fake), mapper, Postgres repository (integration), HTTP handler (integration, including the unknown-field → 400 case)

Removing `example` (once the new module passes its tests):
- [ ] Delete `internal/modules/example/`
- [ ] `cmd/api/main.go`: remove `example.New(pool)` and its route registration
- [ ] `db/schema/example/`, `db/queries/example/`: delete; `sqlc.yaml`: remove the entry
- [ ] `db/migrations/00001_init.sql`: delete (creates the `items` table); generate the new schema's initial one: `go run ./cmd/migrate up` already applies existing migrations — for a new migration from the schema, write the SQL by hand at `db/migrations/NNNNN_init.sql` (goose doesn't auto-generate a diff; sqlc doesn't read migrations in this setup, only `db/schema/`)
- [ ] `internal/platform/httperr/error.go`: remove `ITEM_NOT_FOUND`, `INVALID_ITEM_NAME`, `INVALID_ITEM_STATUS`, `INVALID_ITEM_STATUS_TRANSITION`
- [ ] `internal/platform/observability/metrics.go`: remove the `example_*` metrics
- [ ] `CONTEXT.md`: remove the "(example)" lines
- [ ] `docs/architecture.md` §2: rewrite the paragraph about `internal/modules/example/` to describe the real module as the reference
- [ ] `grep -rn "example\|Item\b\|item_" internal db CONTEXT.md --exclude=architecture-rules.md` should find no leftovers (`docs/architecture-rules.md` mentions `example` only as part of the vocabulary, not as live code)
- [ ] References to `internal/modules/example/` in `CLAUDE.md`, skills, and agents already say "or the most complete real module" — nothing to edit there

Final validation (everything green):

```bash
go build ./... && go vet ./... && test -z "$(gofmt -l .)"
go test ./...
go run ./scripts/compose -- -f docker-compose.test.yml up -d --wait
go run ./cmd/migrate up
go test -tags=integration ./...
```

Commit: `feat(<module>): <summary>` — and `chore: remove example module` if you'd rather split it.

Review before commit:
- If Claude Code was opened in the project's folder (project agents/skills loaded): run the `arch-reviewer` agent over `internal/modules/<module>/` and the `observability-enforcer` skill.
- Otherwise (e.g. a subagent working in a different folder): read the project's `.claude/agents/arch-reviewer.md` and `.claude/skills/observability-enforcer/SKILL.md` and apply their checklists by hand over the module, reporting in the format they define.

With no remote, don't merge into `main` on your own: leave the branch ready and report it in step 9 (the normal flow is a PR).

## Step 9 — Hand off to the user

Report:
- placeholders used (including `{{module-path}}`)
- `prompts/00-estrutura-arquitetural.md`'s **Result** section, completed with what happened in steps 8–9
- build / vet / gofmt / unit / integration results (test counts)
- assumptions recorded in the spec (autonomous mode)
- any adjustments the kit needed (if any)
- pending items (missing Docker, sqlc not installed, plugins not installed, GitHub remote)
- next step: a new session starts with the `session-start` skill; subsequent modules follow the normal feature flow (branch → brainstorming → plan → TDD → review → PR)

---

## Rules that apply after the bootstrap

They live in the project's `CLAUDE.md` and `docs/architecture-rules.md`. Summary:
- New branch from `origin/main` per task; end of task = PR.
- Feature: brainstorming → spec → writing-plans → subagent-driven-development / tdd-agent → observability-enforcer → arch-reviewer → verification-before-completion → commit → PR.
- Relevant prompts go in `prompts/`.
