# Storefront Cache — Design Spec

## Goal

Add two cache layers (in-process L1 + Redis L2) to the storefront's product listing, with granular per-product invalidation via the ERP sync service, refresh-ahead to avoid cache stampede, and LFU eviction on L1.

## Context

`ListProductsUseCase` calls `IProductRepository.findAll({ page, limit })`, which goes straight to Postgres on every request. As traffic grows, reads need to be protected. The product base is large — a per-page cache would be fully invalidated on every sync, overloading the DB. Granular per-product cache with a Redis Sorted Set solves ordering and pagination without that problem.

## Architecture

### Cache layers

**L1 — In-process (ProductCacheService)**
- Structure: `Map<string, { data: ProductResponseItem, expiresAt: number, frequency: number }>`
- Eviction: LFU — upon reaching max entries (1000), removes the entry with the lowest `frequency`
- Every access (`getProduct`) increments `frequency`
- TTL: 600s base ± 10s jitter = `600 + Math.floor(Math.random() * 20) - 10` seconds

**L2 — Redis (ProductCacheService)**
- `products:sorted` — Redis Sorted Set; score = `createdAt` timestamp (ms); members = product UUIDs
- `product:{id}` — JSON string of `ProductResponseItem`; TTL identical to L1 (with independent jitter)
- `products:total` — string with the total product count; identical TTL

### Read flow — `CachedProductRepository.findAll({ page, limit })`

```
1. IDs and total:
   a. L1 check: does an ID list exist in memory?
      → yes: use it
      → no: ZRANGE products:sorted 0 -1 WITHSCORES on Redis
         → hit: populate L1, use it
         → miss: query DB (findAll with no limit), ZADD all + SET products:total, populate L1

2. Pagination: slice IDs by offset/limit

3. For each ID on the page:
   a. L1 check → hit: return, increment frequency
   b. GET product:{id} on Redis → hit: populate L1, return
   c. Miss: query DB for that product, SET product:{id} on Redis + populate L1

4. Return { products: [...], total }
```

### Invalidation / update via sync — `ProcessSyncJobUseCase`

Injects `IProductCacheUpdater` (a port in erp-adapter).

**`product` entity (after `productRepo.upsert`):**
- Reads `product:{id}` from L1 or L2 to preserve the current `availableQuantity`
- On cache miss (new product): `ZADD products:sorted <createdAt_ms> <id>` to include it in the Sorted Set; does not populate `product:{id}` yet — the next read via `CachedProductRepository` populates it with the correct `availableQuantity` from the DB
- On cache hit (existing product): updates the `{ sku, name, price }` fields while keeping `availableQuantity`; writes back to L1 + L2 with a new TTL

**`stock_flow` entity (after `stockFlowRepo.createIfNotExists`):**
- Reads `product:{productId}` from L1 or L2
- Cache hit: `availableQuantity += payload.quantity`; writes back to L1 + L2
- Cache miss: ignored — the next read recomputes `SUM(quantity)` via the DB (normal cache-aside)

### Refresh-ahead — `CacheRefreshScheduler`

Runs in the main process via `setInterval` every 60s.

**Logic per iteration:**
1. Iterates over all L1 Map entries
2. For entries with `expiresAt - Date.now() < 120_000ms` (2 min remaining): triggers an async refresh
   - Fetches the product from the DB (`prisma.product.findUnique` + sum of stockFlow)
   - Rewrites `product:{id}` in L1 + L2 with a renewed TTL
3. Ensures the `products:sorted` Sorted Set has a renewed TTL when below the threshold

**Startup warm-up:** on initialization, `CacheRefreshScheduler.warmAll()` runs `ZRANGE products:sorted 0 -1`, fetches all `product:{id}` from Redis into L1. If Redis is also cold, loads everything from the DB.

### Port in erp-adapter

```typescript
// src/modules/erp-adapter/repositories/product-cache-updater.ts
export interface IProductCacheUpdater {
  updateProduct(id: string, data: {
    sku: string
    name: string
    price: number
    updatedAt: Date
  }): Promise<void>

  updateAvailableQuantity(productId: string, delta: number): Promise<void>
}
```

Registered in the catalog container: `ProductCacheService` as `IProductCacheUpdater`.

## File structure

```
src/modules/catalog/
  cache/
    product-cache-service.ts      # L1 Map (LFU) + L2 Redis ops, TTL/jitter
    cache-refresh-scheduler.ts    # setInterval worker, warm-up
  infra/
    persistence/
      cached-product-repository.ts  # IProductRepository decorator
src/modules/erp-adapter/
  repositories/
    product-cache-updater.ts      # IProductCacheUpdater port
```

Modified:
- `src/modules/erp-adapter/use-cases/process-sync-job/process-sync-job.ts` — injects `IProductCacheUpdater`
- `src/modules/catalog/container.ts` — registers `ProductCacheService` + `CachedProductRepository` + `CacheRefreshScheduler`
- `src/modules/erp-adapter/container.ts` — registers `ProductCacheService` as `IProductCacheUpdater`

## Constraints

- `ioredis` already present — no new dependency required
- Base TTL: 600s; jitter: ±10s; refresh-ahead threshold: 120s; scheduler interval: 60s
- L1 max entries: 1000; eviction: LFU (lowest frequency)
- Redis key prefix: `products:sorted`, `product:{id}`, `products:total`
- `IProductCacheUpdater` defined in erp-adapter, implemented in catalog — respects the dependency rule (erp-adapter does not import catalog)
- `CachedProductRepository` is infra — `ListProductsUseCase` does not change
- Redis failure (L2 down): L1 keeps serving; if L1 also misses, fallback to the DB with no error surfaced to the user
- Tests: Redis mocks (`ioredis-mock` or vi.mock) for unit tests; integration with the existing real Redis for integration tests
