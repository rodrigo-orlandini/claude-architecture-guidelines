# {{PROJECT_NAME}}

Modular monolith with Clean Architecture (TypeScript + Fastify + tsyringe + Prisma + Vitest).
Each module in `src/modules/<module>/` is a bounded context extractable as a microservice without rework.

## Required reading before coding

- `CONTEXT.md` — domain glossary (entity names, modules, invariants)
- `src/shared/core/architecture-rules.md` — inviolable rules for layers, Either, DI, naming, tests, observability
- `docs/architecture.md` — full structure design
- Reference module: `src/modules/example/` while it exists; once removed, the most complete real module in `src/modules/` — copy its pattern

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

- `npm run typecheck` — tsc without emitting (code + specs)
- `npm run lint` — eslint (`no-console` active)
- `npm run test:unit` — unit (no I/O)
- `npm run test:integration` — brings up `docker-compose.test.yml`, recreates the schema on the test database, runs `*.integration-spec.ts`
- `npm run test:coverage` — unit + integration with combined coverage (threshold 80%)
- `npm run db:migrate` — prisma migrate dev
- `npm run dev` — app + Postgres + Redis in containers
- `node scripts/compose.mjs <args>` — portable `docker compose` (automatically uses `wsl docker` on Windows without Docker Desktop)
- `node scripts/compose.mjs -f docker-compose.observability.yml up -d` — Prometheus, Grafana, Loki, Tempo
