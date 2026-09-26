# Design: ERP Sync — Transactional Outbox + BullMQ

**Date:** 2026-09-20
**Scope:** One-way ERP → reference-project sync via polling, outbox pattern, BullMQ, idempotency, retry/backoff/DLQ, and observability

---

## 1. Context and Goal

The ERP is simulated by a second PostgreSQL instance with a schema identical to the reference project's. The system has **read-only** access to the ERP database. The goal is to keep the reference project's `products` and `stock_flows` in sync with the ERP within a few seconds of latency, with no phantom messages, no duplicates, and full resilience to transient failures.

---

## 2. Added Stack

| Component | Technology |
|---|---|
| Queue | BullMQ (`bullmq`) |
| Queue monitoring | Bull Board (`@bull-board/api`, `@bull-board/fastify`) |
| Polling threads | Node.js `worker_threads` |
| ERP DB | PostgreSQL 16 (second container) |

---

## 3. Flow Architecture

```
ERP DB (read-only, postgres-erp:5432)
    │
    │  cursor-based polling
    │  ProductPoller: 15s  — Worker Thread
    │  StockFlowPoller: 5s — Worker Thread
    │
    ▼
outbox table (our DB) ◄── atomic write with cursor advance
    │
    │  relay setInterval 1.5s (main thread)
    │
    ▼
BullMQ queue "erp-sync" (Redis)
    │
    │  BullMQ Worker (main thread)
    │  attempts: 5, backoff: exponential 1s
    │
    ▼
products / stock_flows (our DB)
    │
    ▼
outbox.status = PROCESSED
```

A failure at any stage neither advances the cursor nor loses the event:
- Poller crash before COMMIT → cursor does not advance → next cycle redetects
- Relay crash after enqueue but before UPDATE → outbox stays PENDING → next relay re-enqueues → BullMQ dedup by `jobId` prevents a duplicate in the worker
- Worker failure → BullMQ retries with backoff → after 5 attempts → `failed` queue (DLQ) + outbox `DEAD`

---

## 4. Data Layer

### 4.1 New tables in the reference project DB

```prisma
enum OutboxStatus {
  PENDING
  ENQUEUED
  PROCESSED
  DEAD
}

model SyncCursor {
  entity       String   @id
  lastSyncedAt DateTime @map("last_synced_at")

  @@map("sync_cursors")
}

model Outbox {
  id          String       @id @default(uuid())
  entity      String                          -- 'product' | 'stock_flow'
  erpId       String       @map("erp_id")     -- record id in the ERP
  payload     Json                            -- ERP row snapshot
  status      OutboxStatus @default(PENDING)
  attempts    Int          @default(0)
  nextRetryAt DateTime?    @map("next_retry_at")
  error       String?
  createdAt   DateTime     @default(now()) @map("created_at")

  @@unique([entity, erpId])
  @@map("outbox")
}
```

### 4.2 Idempotency per entity

| Entity | ON CONFLICT | Reason |
|---|---|---|
| `product` | `DO UPDATE SET payload = EXCLUDED.payload, status = 'PENDING' WHERE status != 'PROCESSED' OR payload != EXCLUDED.payload` | A product can be updated multiple times in the ERP |
| `stock_flow` | `DO NOTHING` | Append-only: the same `erp_id` must not be reprocessed |

In the worker, additional idempotency on the final write:
- `product`: `prisma.product.upsert({ where: { sku } })` — Prisma generates `ON CONFLICT DO UPDATE`
- `stock_flow`: `prisma.stockFlow.createMany({ skipDuplicates: true })` — `ON CONFLICT DO NOTHING` via the `@@unique([id])` constraint (PK)

### 4.3 ERP DB

Schema identical to the reference project's. A second `PrismaClient` pointing to `ERP_DATABASE_URL`. Seed applied to the ERP; initial sync brings all records into the reference project (initial cursor = epoch).

---

## 5. Polling Layer

### 5.1 Worker Threads

Each poller runs in its own `worker_threads.Worker` — isolated event loop, its own `PrismaClient`, a failure in one does not affect the other.

```
src/modules/erp-adapter/infra/scheduler/
├── erp-poller-product.worker.ts     ← Worker Thread
├── erp-poller-stock-flow.worker.ts  ← Worker Thread
└── erp-scheduler.ts                 ← main thread: spawn + monitor
```

`erp-scheduler.ts` spawns the workers at bootstrap and listens for the `'exit'` event — if a worker dies unexpectedly, it logs the error and respawns with backoff.

### 5.2 Logic of each cycle

```typescript
// inside the worker thread
async function pollCycle(entity: 'product' | 'stock_flow') {
  await prisma.$transaction(async (tx) => {
    const cursor = await tx.syncCursor.findUnique({ where: { entity } })
    const since = cursor?.lastSyncedAt ?? new Date(0)

    const rows = await erpPrisma[table].findMany({
      where: { [timestampField]: { gt: since } },
      orderBy: { [timestampField]: 'asc' },
    })

    if (rows.length === 0) return

    await tx.outbox.createMany({
      data: rows.map(row => ({ entity, erpId: row.id, payload: row, status: 'PENDING' })),
      skipDuplicates: false, // handled by upsert below for products
    })
    // products: upsert resets to PENDING if payload changed
    // stock_flows: createMany with skipDuplicates: true

    const newCursor = rows[rows.length - 1][timestampField]
    await tx.syncCursor.upsert({
      where: { entity },
      update: { lastSyncedAt: newCursor },
      create: { entity, lastSyncedAt: newCursor },
    })
  })
}
```

### 5.3 Intervals

| Poller | Interval | Env var |
|---|---|---|
| `ProductPoller` | 15s | `POLL_INTERVAL_PRODUCTS_MS=15000` |
| `StockFlowPoller` | 5s | `POLL_INTERVAL_STOCK_FLOWS_MS=5000` |

---

## 6. Relay Layer

Runs on the main thread. 1.5s `setInterval` (`RELAY_INTERVAL_MS=1500`).

```typescript
async function relayBatch() {
  const pending = await prisma.outbox.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: 50,
  })
  if (pending.length === 0) return

  await Promise.all(
    pending.map(entry =>
      erpSyncQueue.add(
        `${entry.entity}:${entry.erpId}`,
        { entity: entry.entity, erpId: entry.erpId, payload: entry.payload, correlationId: entry.id },
        { jobId: `${entry.entity}:${entry.erpId}` }, // BullMQ dedup
      )
    )
  )

  await prisma.outbox.updateMany({
    where: { id: { in: pending.map(e => e.id) } },
    data: { status: 'ENQUEUED' },
  })
}
```

---

## 7. BullMQ Worker

```typescript
const worker = new Worker('erp-sync', async (job) => {
  const { entity, erpId, payload, correlationId } = job.data
  const span = tracer.startSpan('erp.sync.process')
  span.setAttribute('entity', entity)
  span.setAttribute('erp_id', erpId)
  span.setAttribute('attempt', job.attemptsMade)

  try {
    if (entity === 'product') {
      await prisma.product.upsert({
        where: { sku: payload.sku },
        update: { name: payload.name, price: payload.price, updatedAt: new Date(payload.updated_at) },
        create: { id: payload.id, sku: payload.sku, name: payload.name, price: payload.price },
      })
    }

    if (entity === 'stock_flow') {
      await prisma.stockFlow.createMany({
        data: [{ id: payload.id, productId: payload.product_id, quantity: payload.quantity, movedAt: new Date(payload.moved_at) }],
        skipDuplicates: true,
      })
    }

    await prisma.outbox.update({
      where: { entity_erpId: { entity, erpId } },
      data: { status: 'PROCESSED', error: null },
    })

    logger.info({ correlationId, entity, erpId, attempt: job.attemptsMade }, 'erp.sync.processed')
    span.setAttribute('status', 'processed')
  } finally {
    span.end()
  }
}, {
  connection: redisConnection,
})

// DLQ: mark outbox as DEAD once all attempts are exhausted
worker.on('failed', async (job, err) => {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 5)) return
  await prisma.outbox.update({
    where: { entity_erpId: { entity: job.data.entity, erpId: job.data.erpId } },
    data: { status: 'DEAD', error: err.message, attempts: job.attemptsMade },
  })
  logger.error({ jobId: job.id, entity: job.data.entity, erpId: job.data.erpId, error: err.message }, 'erp.sync.dead')
})
```

**Queue configuration:**

```typescript
const erpSyncQueue = new Queue('erp-sync', { connection: redisConnection })

defaultJobOptions: {
  attempts: Number(process.env.SYNC_JOB_ATTEMPTS ?? 5),
  backoff: {
    type: 'exponential',
    delay: Number(process.env.SYNC_JOB_BACKOFF_DELAY_MS ?? 1000),
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: false, // kept in 'failed' for inspection via Bull Board
}
```

---

## 8. Observability

### 8.1 Logs per event

| Event | Level | Fields |
|---|---|---|
| Poll cycle | `debug` | `entity`, `cursor`, `rowsDetected`, `durationMs` |
| Outbox write | `debug` | `entity`, `erpId`, `action` ('inserted'\|'updated'\|'skipped') |
| Relay batch | `info` | `count`, `durationMs` |
| Job start | `debug` | `jobId`, `entity`, `erpId`, `attempt` |
| Job success | `info` | `jobId`, `entity`, `erpId`, `durationMs` |
| Job failure (retry) | `warn` | `jobId`, `entity`, `erpId`, `attempt`, `error`, `nextRetryMs` |
| Job dead | `error` | `jobId`, `entity`, `erpId`, `totalAttempts`, `finalError` |
| Worker respawn | `warn` | `entity`, `exitCode`, `backoffMs` |

`correlationId` propagated across all logs of the same cycle.

### 8.2 OTel Spans

```
erp.poll.<entity>        poller thread — cursor → outbox write
  └─ erp.relay.enqueue   relay — outbox → BullMQ
       └─ erp.sync.process worker — job → DB upsert
```

### 8.3 Bull Board

```typescript
// src/infra/http/server.ts
const serverAdapter = new FastifyAdapter()
createBullBoard({ queues: [new BullMQAdapter(erpSyncQueue)], serverAdapter })
app.register(serverAdapter.registerPlugin(), { prefix: '/admin/queues' })
```

Route: `GET /admin/queues` — UI with waiting/active/completed/failed queues, manual retry of dead jobs.

---

## 9. Docker Infrastructure

### 9.1 docker-compose.yml (addition)

```yaml
postgres-erp:
  container_name: reference-project-postgres-erp
  image: postgres:16-alpine
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: reference_project_erp
  ports:
    - "5434:5432"
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 5s
    timeout: 5s
    retries: 5
```

### 9.2 docker-compose.test.yml (addition)

```yaml
postgres-erp-test:
  container_name: reference-project-postgres-erp-test
  image: postgres:16-alpine
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: reference_project_erp_test
  ports:
    - "5435:5432"
```

### 9.3 New env vars

```
ERP_DATABASE_URL=postgresql://postgres:postgres@reference-project-postgres-erp:5432/reference_project_erp
TEST_ERP_DATABASE_URL=postgresql://postgres:postgres@localhost:5435/reference_project_erp_test
POLL_INTERVAL_PRODUCTS_MS=15000
POLL_INTERVAL_STOCK_FLOWS_MS=5000
RELAY_INTERVAL_MS=1500
SYNC_JOB_ATTEMPTS=5
SYNC_JOB_BACKOFF_DELAY_MS=1000
```

---

## 10. `erp-adapter` Module Structure

```
src/modules/erp-adapter/
├── entities/
│   └── outbox-entry.ts
├── repositories/
│   ├── outbox-repository.ts
│   └── sync-cursor-repository.ts
├── use-cases/
│   ├── poll-erp-products/
│   │   ├── poll-erp-products.ts
│   │   └── poll-erp-products.spec.ts
│   ├── poll-erp-stock-flows/
│   │   ├── poll-erp-stock-flows.ts
│   │   └── poll-erp-stock-flows.spec.ts
│   └── process-sync-job/
│       ├── process-sync-job.ts
│       └── process-sync-job.spec.ts
├── infra/
│   ├── persistence/
│   │   ├── prisma-outbox-repository.ts
│   │   ├── prisma-outbox-repository.integration-spec.ts
│   │   └── prisma-sync-cursor-repository.ts
│   ├── queue/
│   │   ├── bullmq-relay.ts
│   │   └── bullmq-sync-worker.ts
│   └── scheduler/
│       ├── erp-poller-product.worker.ts
│       ├── erp-poller-stock-flow.worker.ts
│       └── erp-scheduler.ts
└── container.ts
```

---

## 11. Seed and Initial Sync

1. `node prisma/seed.mjs --target erp` — seeds ~100 products in the ERP DB
2. On the system's first run, `sync_cursors` is empty → initial cursor = epoch → ProductPoller and StockFlowPoller detect all ERP records → outbox populated → relay enqueues → worker applies upsert to all of them → the reference project synced

---

## 12. Tests

| Layer | Type | What to test |
|---|---|---|
| `poll-erp-products` use-case | Unit (fake repos) | Cursor advances, outbox written correctly, correct ON CONFLICT |
| `poll-erp-stock-flows` use-case | Unit (fake repos) | Append-only, skip duplicate |
| `process-sync-job` use-case | Unit (fake repos) | Product upsert, stock_flow createMany, marks PROCESSED |
| `prisma-outbox-repository` | Integration | UNIQUE constraint, status transitions |
| `bullmq-relay` + `bullmq-sync-worker` | Integration (Redis test) | Job enqueued, processed, DLQ after max attempts |
| Worker Thread respawn | Unit | Mock `worker_threads`, verify respawn on unexpected exit |

---

## 13. Decisions and Rationale

| Decision | Reason |
|---|---|
| BullMQ over NATS | Redis already in the stack; Products+StockFlow volume doesn't justify NATS overhead |
| Worker Threads for pollers | Event loop isolation; a failure in one does not affect the other |
| Outbox + relay separate from poller | Decouples change detection from enqueueing; covers the Redis-down window |
| `jobId = entity:erp_id` in BullMQ | Native dedup — relay stays idempotent even without a transaction between enqueue and the outbox UPDATE |
| `skipDuplicates: true` on StockFlow | StockFlow is append-only; the same ERP `id` must not generate two records in the reference project |
| `ON CONFLICT DO UPDATE` on Product | A product can be updated N times; the outbox must reprocess if the payload changed |
| Cursor by `moved_at` / `updated_at` | Timestamp fields already exist in the schema; requires no ERP change |
