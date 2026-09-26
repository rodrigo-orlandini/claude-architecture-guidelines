# BOOTSTRAP-TS — apply the TypeScript structure to a new project

> TypeScript stack (Fastify + tsyringe + Prisma + Vitest). For Go, use `BOOTSTRAP-GO.md`.

Executable playbook. Written for an AI agent with no prior context, but anyone can follow it.

- `$KIT` = the folder this file is in (the `_architecture/` folder whose path was given in the prompt).
- `$DEST` = the new project's root = the current working directory.

Inputs (ask the user if missing; in autonomous execution, derive them):
- **Readable name** → `{{PROJECT_NAME}}` (e.g. `Task Hub`)
- **kebab-case slug** → `{{project-slug}}` (e.g. `task-hub`; derive from the name)
- **snake_case database name** → `{{project_db}}` (e.g. `task_hub`; slug with `-` swapped for `_`)
- **Domain description** (1–3 sentences) — used in step 7; the first sentence becomes `{{PROJECT_DESCRIPTION}}` (the project's README)

**Autonomous mode** (no one available to answer questions or approve): at every point that asks for a user response/approval, pick the simplest option compatible with the domain description, record the decision in an **Assumptions** section of the spec (step 7), and proceed. Never invent a requirement the description doesn't suggest.

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

If the description has `/` or `&`, escape them in `sed` or edit `README.md` by hand.

`grafana/provisioning/dashboards/app.json` contains `{{route}}` — that's Grafana syntax, **don't** substitute it (the command above doesn't touch it).

Verify: `grep -rn '{{PROJECT_NAME}}\|{{project-slug}}\|{{project_db}}\|{{PROJECT_DESCRIPTION}}' .` should come back empty.

## Step 4 — Environment and dependencies

```bash
cp .env.example .env
npm install
npx prisma generate
```

## Step 5 — Validate the template (before changing anything)

```bash
npm run typecheck        # code + specs
npm run lint
npm run test:unit
npm run test:integration # needs Docker: brings up docker-compose.test.yml, recreates the test DB schema, runs integration
```

All of these must pass. If something fails because of a kit defect, fix it in the project and **tell the user** which kit file needed the adjustment.

## Step 6 — Initial commit

```bash
git init -b main          # if not already a repository
git add .
git commit -m "chore: bootstrap modular monolith architecture"
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
3. `prompts/00-estrutura-arquitetural.md`: **Prompt** section = the exact text that started this bootstrap (replace the whole block with what the user sent); **Result** section = what's been generated so far (finish it in step 9).
4. `prompts/01-initial-domain.md` in the same format, recording the domain brainstorming.
5. `PROMPTS.md`: add the 01 line to the index.
6. Commit: `docs: domain model and initial spec`.

Reference of a real filled-in project: `$KIT/reference/reference-project/` (`CONTEXT.md`, specs in `docs/`, `prompts/`).

## Step 8 — First real module, and removing `example`

Implement **only the first module** now (the rest follow the normal feature flow, one per branch). Mirror `src/modules/example/`: same folders, patterns, and test types. Reference files as needed:

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

With no remote, don't merge into `main` on your own: leave the branch ready and report it in step 9 (the normal flow is a PR).

## Step 9 — Hand off to the user

Report:
- placeholders used
- `prompts/00-estrutura-arquitetural.md`'s **Result** section, completed with what happened in steps 8–9
- typecheck / lint / unit / integration results (test counts)
- assumptions recorded in the spec (autonomous mode)
- any adjustments the kit needed (if any)
- pending items (missing Docker, plugins not installed, GitHub remote)
- next step: a new session starts with the `session-start` skill; subsequent modules follow the normal feature flow (branch → brainstorming → plan → TDD → review → PR)

---

## Rules that apply after the bootstrap

They live in the project's `CLAUDE.md` and `src/shared/core/architecture-rules.md`. Summary:
- New branch from `origin/main` per task; end of task = PR.
- Feature: brainstorming → spec → writing-plans → subagent-driven-development / tdd-agent → observability-enforcer → arch-reviewer → verification-before-completion → commit → PR.
- Relevant prompts go in `prompts/`.
