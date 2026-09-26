# Claude Architecture Guidelines

Portable kit that applies the same architecture and the same AI-assisted development workflow to any new project — instead of rebuilding everything by hand each time, or copy-pasting loose pieces from an old project.

## The idea

After building a modular monolith with Clean Architecture on a real project (the reference project, TypeScript), plus the set of Claude Code skills/agents that uphold that pattern in every session (architecture review, guided TDD, an observability checklist), it became clear it was worth extracting this as a reusable kit instead of rebuilding it from scratch on the next project.

This repository is that kit. It packages three things:

1. **A complete, validated code scaffold** — not an empty skeleton: a working example module (entity, value objects, use cases, repository, HTTP, unit and integration tests) that serves as the reference pattern to copy when building the real module.
2. **The architecture rules, written down** (`docs/architecture-rules.md`) — what's allowed, what isn't, and why — so an AI agent (or a person new to the team) doesn't have to guess.
3. **Claude Code skills and agents** that enforce those rules during development: `session-start` (onboarding), `domain-modeler` (modeling before coding), `tdd-agent` (red-green-refactor loop), `observability-enforcer` (checklist before closing a task), `arch-reviewer` (diff review).

Three stack variants today, same principles, each framework's own idiomatic mechanism:

| | TypeScript + Fastify (`template-ts/`) | TypeScript + NestJS (`template-nest/`) | Go (`template-go/`) |
|---|---|---|---|
| HTTP | Fastify | Nest + `@nestjs/platform-fastify` | native `net/http` (`http.ServeMux`, Go 1.22+) |
| Domain errors | `Either<DomainError, T>` | `Either<DomainError, T>` | `(T, error)`, typed `*httperr.DomainError` |
| DI | tsyringe (container) | Nest's built-in container (`@Injectable`/`@Inject(token)`) | manual wiring in `module.go` per module |
| Port interface | `I` prefix (`IItemRepository`) | `I` prefix (`IItemRepository`) | no prefix (`ItemRepository`), defined by the consumer |
| Data access | Prisma | Prisma (`PrismaService`) | sqlc (generated, typed SQL) + pgx |
| Integration tests | `vitest.integration.ts` + `.integration-spec.ts` suffix | `test/*.e2e-spec.ts` (Nest/Jest convention) | `//go:build integration` build tag + `_integration_test.go` suffix |

Shared by all three:
- **Modular monolith + Clean Architecture** — module = bounded context, dependency rule, ports & adapters
- **Structured logging + correlationId from day one**; full telemetry (Prometheus metrics, OpenTelemetry tracing, the Grafana/Loki/Tempo stack) is opt-in, asked about at bootstrap — see "Scope discipline" below
- **Docker** (dev / test / observability) and **CI** on GitHub Actions with a coverage threshold ≥ 80%
- A superpowers-driven workflow (brainstorm → spec → plan → execution → review → PR) and prompt logging

Each variant has already been validated by running an agent **with no prior context** applying the kit to an empty folder, building a real module from scratch, and running the full suite (build, lint, unit, integration against a real Postgres).

## Quick start

**Only prerequisite:** [Claude Code](https://docs.claude.com/claude-code) installed. Everything else (Node or Go, Docker, plugins) is checked by the bootstrap itself, which tells you what's missing — but if you want to get ahead of it, see [`SETUP.md`](./SETUP.md).

1. Clone this repository somewhere fixed on your machine (doesn't need to be inside the new project):

   ```bash
   git clone https://github.com/rodrigo-orlandini/claude-architecture-guidelines.git ~/claude-architecture-guidelines
   ```

2. Create the new project's folder (empty, or with just `.git`), open Claude Code in it, and paste:

   ```
   Read ~/claude-architecture-guidelines/BOOTSTRAP.md and follow it to apply the structure to this project.
   ```

   Give it whatever you already know — language, framework, project name, scope — and it asks for whatever's missing. It never guesses these; it stops and asks.

3. The agent copies the matching template (TypeScript+Fastify, TypeScript+NestJS, or Go), substitutes the placeholders, installs dependencies, and validates everything (build + tests, unit and integration against a real Postgres). **It stops there — it doesn't model your domain or write any feature on its own.**

4. From there, development is prompt-driven and incremental, the same as any other day with this kit: tell it what to build first, or, if you have the `superpowers` plugin, ask it to run `superpowers:brainstorming` to plan the domain with you before writing code. Either way, it builds one module/slice at a time through the normal flow (`session-start` → brainstorming → plan → TDD → review → PR), not the whole system in one shot.

Without AI, or to understand each step before running it: follow `BOOTSTRAP-TS.md`/`BOOTSTRAP-NEST.md`/`BOOTSTRAP-GO.md` manually — every step is an ordinary command (`cp`, `sed`, `npm`/`go`, `git`).

## Contents

```
_architecture/
├── README.md          ← this file
├── SETUP.md            ← machine / Claude Code prerequisites and setup (sections [TS]/[Go] where they diverge)
├── BOOTSTRAP.md         ← dispatcher: gathers inputs (language, framework, name, scope, observability), routes to a playbook
├── BOOTSTRAP-TS.md       ← executable playbook, TypeScript + Fastify
├── BOOTSTRAP-NEST.md     ← executable playbook, TypeScript + NestJS
├── BOOTSTRAP-GO.md       ← executable playbook, Go
├── template-ts/          ← files copied into the new project's root (TypeScript + Fastify, with placeholders)
│   ├── CLAUDE.md, CONTEXT.md, PROMPTS.md, README.md
│   ├── .claude/         ← settings.json (plugins), agents/, skills/
│   ├── docs/            ← architecture.md, adr/, superpowers/{specs,plans}/
│   ├── prompts/         ← prompt-logging convention + prompt 00
│   ├── src/             ← shared core + observability + HTTP infra + complete `example` module
│   ├── prisma/          ← schema with an example model
│   ├── grafana/, prometheus.yml, docker-compose*.yml, Dockerfile
│   ├── scripts/compose.mjs  ← portable `docker compose` (native or via WSL)
│   ├── .github/workflows/ci.yml
│   └── package.json, tsconfig*.json, vitest*.ts, .eslintrc.cjs, .env.example, .gitignore
├── template-nest/         ← files copied into the new project's root (TypeScript + NestJS, with placeholders)
│   ├── CLAUDE.md, CONTEXT.md, PROMPTS.md, README.md
│   ├── .claude/         ← settings.json (plugins), agents/, skills/
│   ├── docs/            ← architecture.md, adr/, superpowers/{specs,plans}/
│   ├── prompts/         ← prompt-logging convention + prompt 00
│   ├── src/             ← shared core + observability + complete `example` module (entities, use-cases, Nest controller/module)
│   ├── prisma/          ← schema with an example model
│   ├── test/            ← e2e specs (Nest/Jest convention: full app + supertest, and adapter-only)
│   ├── grafana/, prometheus.yml, docker-compose*.yml, Dockerfile
│   ├── scripts/compose.mjs  ← portable `docker compose` (native or via WSL)
│   ├── .github/workflows/ci.yml
│   └── package.json, nest-cli.json, tsconfig*.json, jest*.config.js, .eslintrc.cjs, .env.example, .gitignore
├── template-go/          ← files copied into the new project's root (Go, with placeholders)
│   ├── CLAUDE.md, CONTEXT.md, PROMPTS.md, README.md
│   ├── .claude/         ← settings.json (plugins), agents/, skills/
│   ├── docs/            ← architecture.md, architecture-rules.md, adr/, superpowers/{specs,plans}/
│   ├── prompts/         ← prompt-logging convention + prompt 00
│   ├── cmd/api, cmd/migrate  ← process bootstrap; migrations via goose (library, not a CLI)
│   ├── internal/platform/    ← config, db (pgxpool), httpserver (net/http + middleware), httperr, observability
│   ├── internal/modules/example/  ← complete domain, usecase, adapters/{httpapi,postgres}
│   ├── db/{migrations,schema,queries}/, sqlc.yaml
│   ├── grafana/, prometheus.yml, docker-compose*.yml, Dockerfile
│   ├── scripts/compose/  ← portable `docker compose` (native or via WSL), no Node dependency
│   ├── .github/workflows/ci.yml
│   └── go.mod, go.sum, Makefile, .env.example, .gitignore
└── reference/reference-project/  ← original material (read-only, a real filled-in example, TypeScript stack)
    ├── CONTEXT.md, PROMPTS.md, CLAUDE.md, architecture-rules.md
    ├── prompts/     ← real prompts 00–06 (including 00, which created this structure, and 03, git/CI)
    ├── docs/        ← real design specs plus one example implementation plan
    ├── sdd-ledger-example/  ← an example subagent-driven-development ledger
    ├── claude/      ← the original .claude/ (agents, skills, settings)
    └── ci-original.yml
```

## Template placeholders

| Placeholder | Example | Where it appears |
|---|---|---|
| `{{PROJECT_NAME}}` | `Task Hub` | docs, skills, agents, API title, dashboard |
| `{{project-slug}}` | `task-hub` | package/module name, container names, metrics, tracer |
| `{{project_db}}` | `task_hub` | Postgres database names (dev/test), CI |
| `{{PROJECT_DESCRIPTION}}` | `API for small teams to manage tasks.` | the project's README |
| `{{module-path}}` **[Go only]** | `github.com/acme/task-hub` | `go.mod` and every internal import |

## Principles the kit preserves (in every stack)

1. Module = bounded context. Nothing crosses a module boundary without an interface (port).
2. Domain knows nothing about infra. Use cases return a typed error (`Either` in TS, `(T, error)` in Go); controllers/handlers only match on it.
3. All wiring is centralized (`container.ts` in TS+Fastify, a Nest `*.module.ts` in TS+Nest, `module.go` in Go). No instantiating a concrete adapter anywhere else.
4. Test before code, fakes instead of mocks, integration tests against a real database in Docker.
5. **Start simple, add complexity only when asked.** A cache, a queue, an outbox pattern, or full telemetry (tracing/metrics/Grafana) are opt-in layers — bootstrap asks about observability up front, and anything else gets asked about when it comes up, not assumed because a "real" system might need it eventually. Structured logging + correlationId are the one exception: always on, in every project, regardless of size.
6. Every feature: spec → plan → TDD → automated review → verification → PR.
7. Decisions and prompts get recorded (`docs/superpowers/`, `docs/adr/`, `prompts/`).

## Adding a new stack or framework option

Same shape as `template-nest/`: a `template-<name>/` folder with the same example module (simple VO, enum VO with a transition, entity with behavior, create/list/get, mapper, real repository + fake, HTTP handler with a route test covering "unknown field in the body"), an adapted `docs/architecture.md` + architecture rules file, a `.claude/` with the same 4 skills + 2 agents, and a new `BOOTSTRAP-<NAME>.md` referenced by the `BOOTSTRAP.md` dispatcher (add a row to its routing table). Always validate with a context-free agent applying the kit to an empty folder, and actually boot the app and curl it — every variant so far has surfaced at least one real bug that typecheck/lint alone missed (a Fastify/Ajv validation footgun, a Go middleware ordering bug, a Nest/Jest ESM-vs-CJS dependency mismatch).
