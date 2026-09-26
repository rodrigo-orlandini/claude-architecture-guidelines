# {{PROJECT_NAME}}

Modular monolith with Clean Architecture (TypeScript + NestJS + Prisma + Jest).
Each module in `src/modules/<module>/` is a bounded context extractable as a microservice without rework.

## Required reading before coding

- `CONTEXT.md` — domain glossary (entity names, modules, invariants)
- `src/shared/core/architecture-rules.md` — inviolable rules for layers, Either, DI, naming, tests, observability
- `docs/architecture.md` — full structure design
- Reference module: `src/modules/example/` while it exists; once removed, the most complete real module in `src/modules/` — copy its pattern

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
  → observability-enforcer (only if observability is enabled — see below)
  → arch-reviewer (diff)
  → verification-before-completion
  → commit + PR
```

Steps that require approval (brainstorming, domain-modeler, plans) require a response from the user. In autonomous execution, with no one to respond: decide on the simplest option compatible with `CONTEXT.md`, record each decision in an **Assumptions** section of the spec, and proceed; never invent a new requirement. This does not apply to the scope-discipline layers above — those get asked about regardless of execution mode.

## Observability

Structured logging (pino) + correlationId propagation are always on — cheap, and useful in any project regardless of size. Full telemetry (OpenTelemetry tracing, Prometheus metrics, the Grafana/Loki/Tempo stack) is opt-in, decided at bootstrap time (see `BOOTSTRAP-NEST.md`). If it was declined for this project:
- `src/shared/observability/tracer.ts`, `metrics.ts` and the `GET /metrics` route don't exist here
- `docker-compose.observability.yml`, `grafana/`, `prometheus.yml` don't exist here
- the `observability-enforcer` skill's metrics/tracing checklist items don't apply — only its logging/correlationId section does

If those files/folders DO exist in this project, full telemetry is on — keep instrumenting new use-cases the same way `use-cases/create-item/create-item.ts` does.

## Git

- Every new task: new branch from `origin/main` (`feat/<name>`, `fix/<name>`, `docs/<name>`).
- Commits in Conventional Commits (`feat(module): ...`, `fix(module): ...`).
- Task completion: open a PR to `main` (`gh pr create`). CI must pass (build → unit + integration → coverage 80%).

## Prompts

Save every relevant prompt in `prompts/`. See `prompts/CLAUDE.md` for naming convention and structure. Update the index in `PROMPTS.md`.

## Commands

- `npm run typecheck` — tsc without emitting
- `npm run lint` — eslint (`no-console` active)
- `npm run test:unit` — unit (no I/O), Jest, co-located `*.spec.ts`
- `npm run test:integration` — brings up `docker-compose.test.yml`, resets the test database schema, runs `test/*.e2e-spec.ts`
- `npm run test:coverage` — unit + e2e with combined coverage (threshold 80%)
- `npm run db:migrate` — prisma migrate dev
- `npm run dev` — app + Postgres in containers (`npm run dev:local` for `nest start --watch` on the host)
- `node scripts/compose.mjs <args>` — portable `docker compose` (automatically uses `wsl docker` on Windows without Docker Desktop)
- `node scripts/compose.mjs -f docker-compose.observability.yml up -d` — Prometheus, Grafana, Loki, Tempo (only if observability was enabled at bootstrap)
