# BOOTSTRAP-TS — apply the TypeScript + Fastify structure to a new project

> TypeScript stack, Fastify framework (Fastify + tsyringe + Prisma + Vitest). For NestJS, use `BOOTSTRAP-NEST.md`; for Go, use `BOOTSTRAP-GO.md`.

Executable playbook. Written for an AI agent with no prior context, but anyone can follow it. Assumes `BOOTSTRAP.md`'s Step A already collected the four required inputs (project name, scope, and — implicitly, by routing here — language + framework); if you're reading this file directly without having gone through `BOOTSTRAP.md`, go do that first.

- `$KIT` = the folder this file is in (the `_architecture/` folder whose path was given in the prompt).
- `$DEST` = the new project's root = the current working directory.
- `{{PROJECT_NAME}}`, `{{project-slug}}`, `{{project_db}}`, `{{PROJECT_DESCRIPTION}}` — derived from the project name and scope gathered in `BOOTSTRAP.md` Step A. Don't re-ask for them here.

This playbook only scaffolds and validates the template (steps 0–6). **It does not model the domain and does not implement any module.** That starts later, from the user's own prompts — see the end of this file.

---

## Step 0 — Prerequisites

Check `$KIT/SETUP.md` §1–2. Minimum: `node -v` (≥ 20), `npm -v`, `git --version`.

Docker: test `docker compose version`; if it fails and you're on Windows, test `wsl docker compose version`. Either works — the template's scripts detect it on their own (`scripts/compose.mjs`). With neither available: tell the user and proceed; typecheck, lint, and unit tests don't need Docker.

## Step 1 — Check the destination

- If `$DEST` already has `package.json`, `src/`, or `.claude/`, **stop and ask** before overwriting. The kit is for a new project; for an existing one, merge file by file manually.
- Empty folder, or with just `.git`/README: proceed.

## Step 2 — Copy the template

Copy **all** of `$KIT/template-ts/`'s contents, including dotfiles (`.claude/`, `.github/`, `.eslintrc.cjs`, `.env.example`, `.gitignore`):

```bash
cp -r "$KIT/template-ts/." "$DEST/"
```

Don't copy `$KIT/reference/` or the root kit's `.md` files.

## Step 3 — Substitute placeholders

In every copied file (including `.claude/`, `.github/`, `grafana/`). On Windows, run this in Git Bash (Claude Code's Bash tool already is Git Bash):

```bash
grep -rl --exclude-dir=node_modules -e '{{PROJECT_NAME}}' -e '{{project-slug}}' -e '{{project_db}}' -e '{{PROJECT_DESCRIPTION}}' . \
  | xargs sed -i -e 's/{{PROJECT_NAME}}/Task Hub/g' -e 's/{{project-slug}}/task-hub/g' -e 's/{{project_db}}/task_hub/g' \
                 -e 's/{{PROJECT_DESCRIPTION}}/API for small teams to manage tasks./g'
```

(Replace the example values above with the real project name/slug/db/description gathered in `BOOTSTRAP.md` Step A.) If the description has `/` or `&`, escape them in `sed` or edit `README.md` by hand.

`grafana/provisioning/dashboards/app.json` contains `{{route}}` — that's Grafana syntax, **don't** substitute it (the command above doesn't touch it).

Verify: `grep -rn '{{PROJECT_NAME}}\|{{project-slug}}\|{{project_db}}\|{{PROJECT_DESCRIPTION}}' .` should come back empty.

## Step 4 — Environment and dependencies

```bash
cp .env.example .env
npm install
npx prisma generate
```

## Step 5 — Observability opt-out (skip this step entirely if the user wants it)

If the user answered "no" to the observability question in `BOOTSTRAP.md` Step A, remove the telemetry layer now, before validating. Structured logging + correlationId stay; only tracing/metrics/Grafana go:

1. Delete `src/shared/observability/tracer.ts` and `src/shared/observability/metrics.ts`.
2. Delete `docker-compose.observability.yml`, `grafana/`, `prometheus.yml`.
3. `src/infra/http/server.ts`: remove the `tracer`/`otelContext`/`metrics`/`register` imports and their use in the `onRequest`/`onResponse` hooks and the `GET /metrics` route. Keep `enterContext(...)`, the `x-correlation-id` header logic, and `GET /health`.
4. `src/main.ts`: remove the `initTracer`/`shutdownTracer` import and calls.
5. Every use-case in `src/modules/*/use-cases/**` that imports `@shared/observability/metrics` or `@shared/observability/tracer`: remove those imports and the `metrics.*.inc()` / `tracer.startSpan(...)` calls, keep the `getLogger()` calls (logging stays).
6. `package.json`: remove the `@opentelemetry/*` and `prom-client` dependencies; run `npm install` again.
7. `CONTEXT.md`: set "Observability" under "Optional Layers Enabled" (add that heading if this template predates it) to "declined at bootstrap".
8. `CLAUDE.md` / `docs/architecture.md`: if their "Observability" sections don't already say "if declined, these don't exist", no need to add it — just make sure the files match what's actually there.

If the user wants it enabled: do nothing here, skip straight to Step 6.

## Step 6 — Validate the template (before changing anything)

```bash
npm run typecheck        # code + specs
npm run lint
npm run test:unit
npm run test:integration # needs Docker: brings up docker-compose.test.yml, recreates the test DB schema, runs integration
```

All of these must pass. If something fails because of a kit defect, fix it in the project and **tell the user** which kit file needed the adjustment.

## Step 7 — Initial commit

```bash
git init -b main          # if not already a repository
git add .
git commit -m "chore: bootstrap modular monolith architecture"
```

Don't push or create a remote repository unless the user asks (`SETUP.md` §5).

## Step 8 — Hand off (stop here)

The scaffold is ready. **Do not model the domain, do not touch `CONTEXT.md` beyond what's already there, do not implement or remove the `example` module.** Report to the user:

- placeholders used (project name, slug, db name, description)
- observability decision (enabled / declined) and what that changed
- typecheck / lint / unit / integration results (test counts)
- any adjustments the kit needed, if it needed any
- pending items (missing Docker, plugins not installed, GitHub remote)

Then wait. Two ways forward, and you don't choose between them — the user does:

- **They already know what to build first.** They'll tell you in their next message. Build it the normal way: `session-start` → (`superpowers:brainstorming` if the decision is non-trivial) → `writing-plans` → `tdd-agent` → `observability-enforcer` → `arch-reviewer` → PR. Use the "Building the first module" reference below for the module's shape and for removing `example` once it's replaced.
- **They haven't said yet.** Don't guess and start building. If `superpowers:brainstorming` shows up among your available skills, offer to run it now to plan the domain together (module boundaries, entities, invariants) before any code — using the scope they gave you in `BOOTSTRAP.md` Step A as the starting point. If that plugin isn't installed, just ask them what to build first.

Work **incrementally** either way, and the same "ask before adding" rule applies to a cache, a queue, or an outbox pattern as it did to observability above — see `CLAUDE.md`, "Scope discipline".

Work **incrementally** either way: one module, or one slice of behavior, per cycle — never the whole domain in one shot.

If the user's very first prompt already included a full domain description, feature list, and instructions to build everything now — treat that as the answer to "they already know what to build first" above, and proceed feature by feature (still one slice at a time, still through the normal TDD/review flow), not as a license to skip straight to a giant single commit.

---

## Building the first module (reference — use when the user asks for it, not automatically)

Mirror `src/modules/example/`: same folders, patterns, and test types. Reference files as needed:

| Need | Copy the pattern from |
|---|---|
| Simple VO with validation | `entities/value-objects/item-name.ts` |
| Enum / state machine | `entities/value-objects/item-status.ts` + `Item.archive()` |
| Creation (POST, 201, body schema) | `use-cases/create-item/` + `infra/http/item-controller.ts` |
| Read by id with 404 | `use-cases/get-item/` + `errors/item-not-found-error.ts` |
| Paginated listing | `use-cases/list-items/` |
| Persistence | `mappers/item-mapper.ts` + `infra/persistence/prisma-item-repository.ts` (+ integration spec) |
| HTTP test (status, schema, 400 for extra field) | `infra/http/item-controller.integration-spec.ts` (`app.inject`) |
| Business id in logs | `addToContext` in `use-cases/create-item/create-item.ts` |
| Wiring | `container.ts` |

Deliverables once the domain is modeled (via `superpowers:brainstorming` or the user's own direction):
1. Filled-in `CONTEXT.md`: replace the example lines, keep the sections. The lines marked "(example)" from the `example` module go away once it's removed (below).
2. Spec at `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` with: context, modules, entities/VOs/invariants, endpoints, out of scope.
3. `prompts/00-estrutura-arquitetural.md`: **Prompt** section = the exact text that started the bootstrap (replace the whole block with what the user sent); **Result** section = what's been generated so far.
4. `prompts/01-<topic>.md` in the same format, recording the domain brainstorming.
5. `PROMPTS.md`: add the 01 line to the index.
6. Commit: `docs: domain model and initial spec`.

Reference of a real filled-in project: `$KIT/reference/reference-project/` (`CONTEXT.md`, specs in `docs/`, `prompts/`).

New module checklist:
- [ ] Model in `prisma/schema.prisma` (domain enum as `String`)
- [ ] New error codes in `src/shared/errors/http-error-mapper.ts`
- [ ] Metrics in `src/shared/observability/metrics.ts` (`<module>_*`)
- [ ] `register<Module>Module()` called in `src/main.ts`; controller registered in `src/infra/http/server.ts`; new swagger tag in `server.ts`
- [ ] Specs for VO, entity, use-cases, mapper, presenter; integration spec for the Prisma repository and the controller (`app.inject`)

Removing `example` (once the new module passes its tests):
- [ ] Delete `src/modules/example/`
- [ ] `src/main.ts`: remove `registerExampleModule`
- [ ] `src/infra/http/server.ts`: remove `ItemController` and the `Items` swagger tag
- [ ] `prisma/schema.prisma`: remove the `Item` model
- [ ] `src/shared/errors/http-error-mapper.ts`: remove `ITEM_NOT_FOUND`, `INVALID_ITEM_NAME`, `INVALID_ITEM_STATUS`, `INVALID_ITEM_STATUS_TRANSITION`
- [ ] `src/shared/observability/metrics.ts`: remove the `example_*` metrics
- [ ] `CONTEXT.md`: remove the "(example)" lines
- [ ] `docs/architecture.md` §2: rewrite the paragraph "While it exists, `src/modules/example/`..." to describe the real module as the reference
- [ ] Migrations: delete `prisma/migrations/00000000000000_init/` (creates the `items` table) and generate the initial one for the new schema:
  - with Docker: `npm run infra:up && npm run db:migrate -- --name init`
  - without Docker: `mkdir -p prisma/migrations/00000000000000_init && npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/00000000000000_init/migration.sql`
- [ ] `grep -rn "example\|Item\b\|item-" src prisma CONTEXT.md --exclude=architecture-rules.md` should find no leftovers (`architecture-rules.md` mentions `example` only as "while it exists")
- [ ] References to `src/modules/example/` in `CLAUDE.md`, skills, and agents already say "or the most complete real module" — nothing to edit there.

Final validation (everything green):

```bash
npm run typecheck && npm run lint && npm run test:unit && npm run test:integration
```

`test:integration` recreates the test database schema on every run (`prisma db push --force-reset`), so removing the `Item` model doesn't break it.

Commit: `feat(<module>): <summary>` — and `chore: remove example module` if you'd rather split it.

Review before commit:
- If Claude Code was opened in the project's folder (project agents/skills loaded): run the `arch-reviewer` agent over `src/modules/<module>/` and the `observability-enforcer` skill.
- Otherwise (e.g. a subagent working in a different folder): read the project's `.claude/agents/arch-reviewer.md` and `.claude/skills/observability-enforcer/SKILL.md` and apply their checklists by hand over the module, reporting in the format they define.

With no remote, don't merge into `main` on your own: leave the branch ready and tell the user (the normal flow is a PR).

---

## Rules that apply after the bootstrap

They live in the project's `CLAUDE.md` and `src/shared/core/architecture-rules.md`. Summary:
- New branch from `origin/main` per task; end of task = PR.
- Feature: brainstorming → spec → writing-plans → subagent-driven-development / tdd-agent → observability-enforcer → arch-reviewer → verification-before-completion → commit → PR.
- Relevant prompts go in `prompts/`.
