# 03 — Git Workflow and CI Pipeline

## Goal

Establish per-task branching discipline with mandatory PRs and a GitHub Actions CI pipeline with a build check, unit tests, integration tests, and a minimum coverage of 80%.

## Context

Codebase growing in file and line volume. Need for per-task traceability and automated quality assurance before merge.

## Prompt

> The changes we're making to the code are growing in number of lines and files, which ends up making it harder to review without tighter control via Git. From now on, when we start a task (I'll signal it), a new branch must be created from origin/main to work on it. On completion, a PR must be created for review. Also, to guarantee the tests are passing with meaningful coverage, let's add a GitHub Actions pipeline to run them. Have an initial job to check that the code compiles (with tsc, or a test build), another for unit tests, and another for integration tests. To measure coverage, if needed, you can add a new job, but as an initial estimate let's use 80%. The job sequence should be: coverage only runs when tests pass, and tests only run when the initial build passes. If you have doubts, clear them up, and let's use superpowers for refinement

## Steering Criteria

**4 jobs in sequence:**
- `build` runs first: validates TypeScript compilation (`tsc --noEmit`) + `prisma generate`. Fails fast with no infrastructure cost.
- `unit-tests` and `integration-tests` depend on `build`, run in parallel with each other — they don't need to wait on one another.
- `coverage` depends on both test jobs — only runs once the suite is green.

**GHA `services:` for integration and coverage:**
- Main Postgres (port 5433), ERP Postgres (port 5435), Redis (port 6380) — mirrors `docker-compose.test.yml`.
- The integration job does not use `docker compose up`; it calls `npx vitest run --config vitest.integration.ts` directly, with the env variables injected by the runner.
- Two `prisma migrate deploy` calls — one for DATABASE_URL (reference_project_test) and one for ERP_DATABASE_URL (reference_project_erp_test). Same schema, two databases.

**Coverage with Vitest 2.x's native merge:**
- The `coverage` job runs both suites: unit first (`--coverage --coverage.reporter=json`), then integration with `--coverage.mergeWith=./coverage/coverage-final.json`.
- 80% thresholds configured in `vitest.config.ts` (unit) and `vitest.integration.ts` (integration + merged). The merged run checks the threshold against the combined coverage.
- We avoided external merge configuration (istanbul-merge, lcov) — Vitest 2.x supports it natively.

**Node 20 LTS** across all jobs.

**Npm cache** enabled in every job via `cache: npm` in `actions/setup-node`.

## Result

`.github/workflows/ci.yml` created with 4 jobs:
- `build`: checkout → setup-node → npm ci → prisma generate → typecheck
- `unit-tests` (needs: build): unit suite without coverage
- `integration-tests` (needs: build): Postgres+Redis services → migrate → vitest integration
- `coverage` (needs: unit-tests + integration-tests): same services → migrate → unit with `--coverage.reporter=json` → integration with `--coverage.mergeWith`

`vitest.integration.ts` updated with a `coverage` block (v8 provider, same excludes list as `vitest.config.ts`, 80% thresholds).

## Revisions

_No iterations — direct implementation after design approval._
