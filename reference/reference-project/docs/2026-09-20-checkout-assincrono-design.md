# Asynchronous Checkout — Design Spec

**Date:** 2026-09-20

---

## Goal

Implement an asynchronous checkout flow: immediate stock reservation, order persistence via Transactional Outbox, simulated background processing with status updates. The system returns 202 Accepted without waiting for billing.

---

## Module

New module `src/modules/checkout/`. Follows the pattern of existing modules (`catalog`, `erp-adapter`): ports in `repositories/`, use cases in `use-cases/`, infra in `infra/persistence/`, `infra/http/` and `infra/queue/`, wiring in `container.ts`.

---

## Data Model (Prisma)

### `orders`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | server-generated |
| `customerId` | String | for traceability |
| `correlationId` | String | from body or server-generated |
| `idempotencyKey` | String UNIQUE | `Idempotency-Key` header |
| `status` | Enum | PENDING, PROCESSING, CONFIRMED, FAILED, FAILED_PERMANENT |
| `attempts` | Int | default 0 |
| `lastError` | String? | message of the last error |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

### `order_items`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `orderId` | FK orders | |
| `productId` | FK products | |
| `quantity` | Int | |

### `stock_reservations`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `orderId` | FK orders | |
| `productId` | FK products | |
| `quantity` | Int | |
| `expiresAt` | DateTime | now + 10 minutes |
| `releasedAt` | DateTime? | null = active reservation |

**Available stock:**
```
availableForSale =
  SUM(stockFlow.quantity)
  - SUM(stock_reservations.quantity WHERE expiresAt > NOW() AND releasedAt IS NULL)
```

Expiration is lazy — no cleanup scheduler. The query always filters `expiresAt > NOW()`.

### `checkout_outbox`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `orderId` | FK orders UNIQUE | |
| `status` | Enum | PENDING, ENQUEUED, PROCESSED, DEAD |
| `attempts` | Int | default 0 |
| `nextRetryAt` | DateTime? | |
| `error` | String? | |
| `createdAt` | DateTime | |

Separate from the existing `outbox` (erp-adapter, different semantics).

---

## Endpoints

### POST /checkout

**Request:**
```
Header: Idempotency-Key: <UUID> (required)
Body: {
  customerId: string,
  correlationId?: string,
  items: [{ productId: string, quantity: number }]
}
```

**Flow:**
1. Validates `Idempotency-Key` — UUID format; 400 if invalid or missing
2. Looks up `Order` with that `idempotencyKey` — if it exists, returns 202 immediately (no reprocessing)
3. For each item: checks the product exists and `availableForSale >= quantity` — 409 if not
4. Single transaction: creates `Order` (PENDING) + `OrderItem[]` + `StockReservation[]` (expiresAt = now + 10min) + `checkout_outbox` (PENDING)
5. Returns 202: `{ orderId, status: "PENDING", createdAt }`

**Errors:**
- 400: `Idempotency-Key` missing or invalid format
- 404: product does not exist
- 409: insufficient stock

### GET /orders/:orderId/status

**Request:** no authentication

**Flow:**
1. Looks up `Order` by `orderId`
2. 404 if it doesn't exist
3. Returns: `{ orderId, status, attempts, lastError, createdAt, updatedAt }`

---

## Asynchronous Processing

### Relay (outbox → BullMQ)

- Interval: 5 seconds
- Poll: fetches `checkout_outbox` entries with status PENDING
- For each record: publishes a job to the `checkout-processing` queue, marks status ENQUEUED

### BullMQ Worker (queue: `checkout-processing`)

Simulates ERP billing with delays between steps:

1. Fetches `Order`, sets status PROCESSING
2. 1s delay — simulates ERP validation
3. 1s delay — simulates ERP reservation
4. 1s delay — simulates ERP billing
5. Sets status CONFIRMED
6. Releases reservations: `releasedAt = NOW()` on all the order's `StockReservation` rows
7. Creates a negative `StockFlow` (actual stock outflow movement)
8. Marks `checkout_outbox` PROCESSED

**On error (after max retries):**
- Sets status FAILED_PERMANENT
- `releasedAt = NOW()` on the reservations (returns stock)
- No `StockFlow`
- Marks `checkout_outbox` DEAD

**Retry:** exponential backoff via BullMQ. Max retries: 3.

---

## File Structure

```
src/modules/checkout/
  domain/
    value-objects/
      order-status.ts               # OrderStatus enum
  dtos/
    checkout-dto.ts                 # CreateCheckoutInput, CreateCheckoutOutput
    order-status-dto.ts             # GetOrderStatusOutput
  errors/
    insufficient-stock-error.ts
    order-not-found-error.ts
    duplicate-idempotency-key-error.ts  # not exposed over HTTP; used internally
  repositories/
    order-repository.ts             # IOrderRepository (interface)
    stock-reservation-repository.ts # IStockReservationRepository (interface)
    checkout-outbox-repository.ts   # ICheckoutOutboxRepository (interface)
  use-cases/
    create-checkout/
      create-checkout.ts
      in-memory-order-repository.ts
      in-memory-stock-reservation-repository.ts
      in-memory-checkout-outbox-repository.ts
      create-checkout.spec.ts
    get-order-status/
      get-order-status.ts
      in-memory-order-repository.ts   # reused from create-checkout if identical
      get-order-status.spec.ts
    process-checkout-job/
      process-checkout-job.ts
      in-memory-order-repository.ts
      in-memory-stock-reservation-repository.ts
      in-memory-checkout-outbox-repository.ts
      process-checkout-job.spec.ts
  infra/
    persistence/
      prisma-order-repository.ts
      prisma-stock-reservation-repository.ts
      prisma-checkout-outbox-repository.ts
    http/
      checkout-controller.ts         # POST /checkout
      order-status-controller.ts     # GET /orders/:orderId/status
    queue/
      bullmq-checkout-relay.ts       # outbox poller
      bullmq-checkout-worker.ts      # job consumer
  container.ts
```

---

## Repository Interfaces

### IOrderRepository

```typescript
interface IOrderRepository {
  findByIdempotencyKey(key: string): Promise<Order | null>
  findById(id: string): Promise<Order | null>
  create(data: CreateOrderData): Promise<Order>
  updateStatus(id: string, status: OrderStatus, opts?: { attempts?: number; lastError?: string }): Promise<void>
}
```

### IStockReservationRepository

```typescript
interface IStockReservationRepository {
  getActiveQuantity(productId: string): Promise<number>  // SUM(quantity WHERE active)
  createMany(reservations: CreateReservationData[]): Promise<void>
  releaseByOrderId(orderId: string): Promise<void>  // releasedAt = NOW()
}
```

### ICheckoutOutboxRepository

```typescript
interface ICheckoutOutboxRepository {
  create(orderId: string): Promise<void>
  markEnqueued(id: string): Promise<void>
  markProcessed(id: string): Promise<void>
  markDead(id: string, error: string): Promise<void>
  findPending(): Promise<CheckoutOutboxEntry[]>
}
```

---

## Test Strategy

### `create-checkout.spec.ts`

- Valid checkout → 202, Order PENDING, reservations created, outbox created
- Duplicate `Idempotency-Key` → returns the existing Order without creating anything
- Product does not exist → `ProductNotFoundError`
- Insufficient stock → `InsufficientStockError`
- Expired reservations (`expiresAt` in the past) do not block stock
- Missing `correlationId` → generated by the use case

### `get-order-status.spec.ts`

- Existing Order → returns correct fields
- Nonexistent `orderId` → `OrderNotFoundError`

### `process-checkout-job.spec.ts`

- Successful job → CONFIRMED status, reservations released, StockFlow created
- Job with error after max retries → FAILED_PERMANENT, reservations released, no StockFlow
- `attempts` incremented on every execution

### Out of scope for unit tests

- Outbox relay → BullMQ (pure infra, no domain logic)
- Mock ERP delays (intentional behavior)
- Swagger route registration

---

## Global Constraints

- Strict TypeScript
- tsyringe DI: `useValue` for instances, `@inject()` in constructors
- Either monad: use cases return `Either<DomainError, Output>`
- In-memory repositories for tests (no framework mocks)
- One commit per tested deliverable (TDD: red → green → commit)
- `erp-adapter` does not import `catalog`; `checkout` does not import `catalog` directly
- Interface file names: no `i-` prefix in the file name (e.g.: `order-repository.ts`), interface with the `I` prefix (e.g.: `IOrderRepository`)
- BullMQ queue `checkout-processing` (new, separate from `erp-sync`)
- `checkout_outbox` separate from the existing `outbox`
