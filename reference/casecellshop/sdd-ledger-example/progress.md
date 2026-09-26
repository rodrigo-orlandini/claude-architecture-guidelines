# SDD ledger — plan: docs/superpowers/plans/2026-09-20-cache-vitrine.md

## Pre-flight scan

| Tasks | Interface produced → consumed | Finding |
|---|---|---|
| T1 → T2 | `ProductCacheService` (full API incl `l1`, `getL1Ids`, `setL1Ids`, `getRedisIds`, `setRedisIds`, `getTotal`) | T2 spec references all methods — consistent |
| T1 → T3 | `IProductCacheUpdater` (updateProduct, updateAvailableQuantity) | T3 adds 4th constructor arg matching the interface — consistent |
| T1 → T4 | `ProductCacheService` (`l1`, `getRedisIds`, `getTotal`, `setL1Ids`, `getProduct`, `setProduct`, `setRedisIds`) | T4 spec uses these methods — consistent |
| T1 → T5 | `ProductCacheService` registered as `IProductCacheUpdater` | T5 catalog container does this — consistent |
| T2 → T5 | `CachedProductRepository(cacheService, prisma)` | T5 instantiates with same signature — consistent |
| T3 → T5 | `ProcessSyncJobUseCase` 4-arg constructor | T5 adds 4th resolve call — consistent |
| T4 → T5 | `CacheRefreshScheduler(cacheService, prisma)` | T5 instantiates with same sig, starts scheduler — consistent |
| T1 self | Tests reference `cache.l1` (public readonly Map) and `l1IdsEntry` (private via cast) | Plan test accesses `l1IdsEntry` via `(cache as unknown as {...}).l1IdsEntry` — acceptable; `l1` is public in impl |
| T3 self | Plan says cache update in outer try; then says wrap in separate try-catch | Contradiction in plan Step 3: first shows cache calls inside main try, then corrects to separate inner try-catch. **Ruling: use separate inner try-catch** — cache failures must not fail sync, per spec constraint "Cache failure does not break sync" and test "does not fail when cacheUpdater.updateProduct throws". Cost if wrong: sync silently fails on cache error (wrong direction). |
| T2 test | `makeRedis()` missing `pipeline._pipeline` shorthand; T2 test doesn't need pipeline directly | T2 tests use `redis.set` directly — no conflict. |

## Rulings

- **R1 (T3 plan contradiction):** Use separate inner try-catch for each cache update call. Cache errors log as WARN and do not propagate. Outer try-catch still handles repo/outbox failures. Spec: "Cache failure does not break sync."
- **R2 (worktree):** Working in place on `feat/cache-vitrine` — already feature branch, GIT_DIR == GIT_COMMON. No worktree needed.
- **R3 (test coverage mandate):** User explicitly requested maximum resilience coverage. Implementers must add beyond plan's listed tests: L2 error on setRedisIds, partial L1 fill (> 1000 entries edge), concurrent-style double-miss, L2 ids hit + individual product miss, T4 scheduler warm-up Redis partial miss (some products cached, some not).

## Task progress

Task 1: fix round 1/5 (1 addressed, 0 open — getTotal error path; commits f39a9be..d9ffaba)
Task 1: complete (commits ada2b68..d9ffaba, review clean after fix round 1)
  Parked minors: trivially-true LFU assertion; duplicate frequency-persistence test — cosmetic only.
Task 2: complete (commits d9ffaba..8974c61, review clean)
  Parked minor: L1 warm + Redis-down-for-zcard leaves `?? l1Ids.length` fallback untested — safe, value is semantically correct, deferred to final review triage.
Task 3: complete (commits 8974c61..c0a3d99, review clean)
  Parked minors: span.end() fires before cache calls (no telemetry coverage of cache latency); entity condition evaluated twice (harmless redundancy). Both cosmetic.
Task 4: complete (commits c0a3d99..586e2eb, review clean)
  Parked minor: `row.price as unknown as { toNumber(): number }` duplicated in refreshProduct + loadAllFromDb — shared helper would reduce drift. Cosmetic.
Task 5: complete (commits 586e2eb..5d7b71c, review clean)
  registerCatalogModule wired with Redis, CachedProductRepository as IProductRepository, IProductCacheUpdater as cacheService, CacheRefreshScheduler started on bootstrap. erp-adapter container resolved IProductCacheUpdater as 4th arg. CacheRefreshScheduler excluded from coverage.

