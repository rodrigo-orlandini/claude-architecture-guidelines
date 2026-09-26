# Task 1 Report: IProductCacheUpdater + ProductCacheService

**Status:** DONE

## Commits

- `f39a9be` feat: add IProductCacheUpdater port and ProductCacheService (L1 LFU + L2 Redis)

## Test Summary

32 tests, 32 passing

## Files Created

- `src/modules/erp-adapter/repositories/product-cache-updater.ts` — `IProductCacheUpdater` port interface
- `src/modules/catalog/cache/product-cache-service.ts` — `ProductCacheService` implementing `IProductCacheUpdater`
- `src/modules/catalog/cache/product-cache-service.spec.ts` — 32 unit tests (plan tests + all 7 extended resilience cases)

## Extended Test Coverage

All 7 user-required extended cases implemented and passing:
1. `setRedisIds` — does not throw when `pipeline.exec()` rejects
2. `getProduct` — L2 hit but `JSON.parse` throws (corrupt data) → returns null gracefully
3. LFU eviction edge: multiple entries at same minimum frequency — one evicted, higher-freq preserved
4. `updateProduct` — L2 hit (Redis but not L1) → properly updates and writes back
5. `updateAvailableQuantity` — negative delta → `availableQuantity` decrements correctly
6. `getProduct` — frequency increments correctly on repeated L1 access (not reset to 1)
7. `setL1Ids` — calling again overwrites previous entry (no stale IDs)

## Implementation Notes

- `l1IdsEntry` is `private` as required; tests cast via `(cache as unknown as { l1IdsEntry: ... })` 
- `JSON.parse` errors isolated in an inner try/catch inside the outer Redis error handler, so corrupt L2 data returns null without the Redis error path masking it
- No `@injectable()` decorator on `ProductCacheService` (registered via `useValue` per brief)
- `jitteredTtlSec()` returns 590–609 range satisfying the `>=590 && <=609` test assertion

## Fix: getTotal Redis Error Resilience Test

**Status:** DONE

**Finding fixed:** `getTotal` wraps `zcard` in try/catch and returns null on error — behavior is correct but no test exercised this path.

**Commit:** `d9ffaba` (test: add getTotal Redis error resilience test)

**Test Summary:** 33 tests, 33 passing (1 new test added)

**Test code:**
```typescript
it('returns null and does not throw when Redis throws', async () => {
  redis.zcard.mockRejectedValue(new Error('NOCONN'))
  expect(await cache.getTotal()).toBeNull()
})
```

This test ensures the `getTotal` method adheres to the global constraint: "cache failure must not throw — must log and return null." All 7 Redis methods in `ProductCacheService` now have corresponding error resilience tests.
