# 02 — ERP Sync (Sync with ERP via Queue)

## Goal

Simulate the ERP database with a mirrored PostgreSQL and implement asynchronous sync with the transactional outbox pattern, idempotency, retry with backoff, DLQ, and full observability.

## Context

Continuation of hardening the reference-project system after the initial storefront. ERP simulated via a second PostgreSQL. Queue tool decision (BullMQ vs NATS) to be made based on a pros/cons analysis.

## Prompt

> Now let's start a strategy to increase the robustness of our system. Record this next request in prompts. We need to simulate the ERP's database, which we're now going to implement sync with ours. For the ERP database, use a postgres with the same structure as the normal one, just for simulation purposes. For the sync, I'm thinking of using a queue with BullMQ or NATS, help me by weighing the pros and cons of these tools so I can decide which to go with. We always need to guarantee sync with no phantom messages, so let's apply the transactional outbox pattern. Also guarantee idempotency, by creating unique constraints in the database on the sync jobs and applying "on conflict" in the queries. Guarantee retry with backoff, timeout, and a dead-letter queue. Let's apply logs and tracing to this process, and later monitor the queue. Use superpowers brainstorming to gather the necessary context and specify how we'll proceed

## Steering Criteria

**BullMQ vs NATS — decision made during brainstorming:**

BullMQ was chosen over NATS for the following reasons:
- NATS requires a separate broker (more infra); BullMQ uses Redis, already present in the stack
- BullMQ has native support for retry with exponential backoff, DLQ (failed queue), deduplication by `jobId`, and Bull Board for monitoring — with no extra code
- NATS is better suited for high-throughput distributed event streaming; the reference project's volume does not justify that complexity

**Transactional outbox — why not publish straight to the queue:**

The ERP poller runs in a Worker Thread. If it published directly to Redis and the process crashed between writing to the ERP and publishing to the queue, the message would be lost. The outbox writes to Postgres atomically alongside detection; the relay (a separate process) reads the outbox and enqueues. Redis can go down and the outbox guarantees reprocessing when it comes back.

**Worker Threads for pollers — why not setInterval on the main thread:**

Pollers do blocking IO (Prisma query) every 5-15s. On the main thread this could delay Fastify's event loop. A Worker Thread isolates the IO in a separate thread. Respawn with exponential backoff via ErpScheduler guarantees automatic recovery without restarting the server.

**Cursor-based polling — why not full poll:**

A query with `WHERE updatedAt > lastSyncedAt` only brings the delta. Full polling every 5s on a large stock flows table would be costly. The cursor stored in `sync_cursors` persists across restarts.

**jobId = `entry.id` (outbox row UUID) — decision made during review:**

Originally implemented as `jobId = entity:erpId`. Final review identified a deadlock: BullMQ silently discards `queue.add()` when `jobId` already exists in `completed`. When a product is updated, the outbox resets to PENDING but `markEnqueued` still fires — the entry stays stuck in ENQUEUED forever. Changing to `jobId = entry.id` guarantees a distinct job per revision; real idempotency lives in the worker via `upsert`/`createIfNotExists`.

## Result

Full implementation across 9 tasks via Subagent-Driven Development. Commits `36b8e95` through `19ad3a1` on the `feat/vitrine-inicial-get-products` branch.

**What was delivered:**
- Two Worker Thread pollers: product (15s), stock flow (5s), with cursor-based polling
- Transactional outbox with lifecycle PENDING → ENQUEUED → PROCESSED | DEAD
- BullMQRelay (1.5s interval): reads the outbox, enqueues, marks ENQUEUED
- BullMQSyncWorker: processes via `ProcessSyncJobUseCase`, idempotent; DLQ after 10 failures
- ErpScheduler: spawns and respawns workers with exponential backoff (1s → 2s → ... → 30s)
- Bull Board at `/admin/queues` for queue monitoring
- `db:seed:erp` and `db:migrate:erp` to set up the simulated ERP database
- 31 passing unit tests

**Gaps identified and not fixed (acceptable):**
- Relay and worker integration tests not run (Docker/Redis unavailable in the dev environment during development) — tests exist and are correct, awaiting the environment
- OTel tracer is a no-op stub — structure present, real integration not implemented
- Minor items from the architectural review not applied (index on the outbox, purge job, etc.)

## Revisions

**Final architectural review (arch-reviewer, Opus model)** identified 6 criticals, 11 important issues, 10 minors. All criticals and the main important issues were fixed:

| # | Problem | Fix applied |
|---|---|---|
| C1 | Prod build: `tsc` doesn't resolve `@shared/*` aliases | Added `tsc-alias` to the build script |
| C2 | Worker Threads with `.js` paths fail in dev (tsx); unhandled `error` event kills the process | Conditional extension `__filename.endsWith('.ts')`; `worker.on('error')` handler |
| C3 | `stop()` respawned workers terminated via `terminate()` | `stopping` flag checked in the `'exit'` listener and the `setTimeout` callback |
| C4 | Outbox deadlock: `jobId = entity:erpId` caused BullMQ to silently discard re-enqueue | `jobId = entry.id` (unique UUID per revision) |
| C5 | Nonexistent `REDIS_HOST` in `.env.example`; two separate `new Redis()` | Parsed `REDIS_URL`; single Redis instance passed to `buildApp(redis)` |
| C6 | Integration tests destroyed the dev database (`deleteMany` against the dev `DATABASE_URL`) | `vitest.integration.ts` injects `DATABASE_URL` on port 5433 and `REDIS_URL` on port 6380 |
| I1 | `ProcessSyncJobUseCase` without `left()` — exceptions escaped the Either | `catch` + `left(new SyncProcessingError(...))` |
| I2 | `relayBatch` without `catch` — unhandled rejection killed the process on Node 22 | `catch` + `logger.error` |
| I3 | `'failed'` listener without try/catch in `markDead` — outbox diverged from BullMQ | `markDead` wrapped in try/catch |
| I4 | `job.data` implicitly `any` | `Worker<SyncJobPayload>` |
| I5 | FK hazard: stock_flow arrives before the product (3x faster) | `SYNC_JOB_ATTEMPTS=10` — backoff covers ~17 min |
| I6 | Re-PENDING did not reset `attempts`/`error` — new cycle with stale state | `ON CONFLICT DO UPDATE SET attempts = 0, error = NULL` |
| I7 | `BullMQRelay`, `BullMQSyncWorker`, `ErpScheduler` instantiated with `new` in `main.ts` | Registered in `erp-adapter/container.ts` via `useFactory`; `main.ts` uses `container.resolve` |
| I8 | Token `'PrismaClient'` only in `catalog/container.ts` — erp-adapter depended on registration order | `src/shared/container.ts` (`registerSharedInfra`) centralizes both Prisma tokens |
