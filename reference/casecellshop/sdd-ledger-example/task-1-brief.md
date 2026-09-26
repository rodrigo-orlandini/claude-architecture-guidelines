### Task 1: IProductCacheUpdater + ProductCacheService

**Files:**
- Create: `src/modules/erp-adapter/repositories/product-cache-updater.ts`
- Create: `src/modules/catalog/cache/product-cache-service.ts`
- Create: `src/modules/catalog/cache/product-cache-service.spec.ts`

**Interfaces:**
- Produces: `IProductCacheUpdater` interface (consumed by Task 3 and Task 5); `ProductCacheService` class with its full public API (consumed by Tasks 2, 4, 5)

- [ ] **Step 1: Write failing tests**

`src/modules/catalog/cache/product-cache-service.spec.ts`:

```typescript
import 'reflect-metadata'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ProductCacheService } from './product-cache-service'
import type { Redis } from 'ioredis'
import type { ProductResponseItem } from '../dtos/list-products-dto'

function item(overrides: Partial<ProductResponseItem> = {}): ProductResponseItem {
  return { id: 'p1', sku: 'SKU-1', name: 'Capa', price: 29.9, availableQuantity: 10, ...overrides }
}

function makeRedis() {
  const mockPipeline = {
    zadd: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  }
  return {
    get: vi.fn<[], Promise<string | null>>().mockResolvedValue(null),
    set: vi.fn<[], Promise<'OK'>>().mockResolvedValue('OK'),
    zadd: vi.fn<[], Promise<number>>().mockResolvedValue(0),
    zrevrange: vi.fn<[], Promise<string[]>>().mockResolvedValue([]),
    zcard: vi.fn<[], Promise<number>>().mockResolvedValue(0),
    pipeline: vi.fn().mockReturnValue(mockPipeline),
    _pipeline: mockPipeline,
  }
}

describe('ProductCacheService', () => {
  let redis: ReturnType<typeof makeRedis>
  let cache: ProductCacheService

  beforeEach(() => {
    redis = makeRedis()
    cache = new ProductCacheService(redis as unknown as Redis)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getProduct', () => {
    it('returns null on L1 and L2 miss', async () => {
      const result = await cache.getProduct('p1')
      expect(result).toBeNull()
      expect(redis.get).toHaveBeenCalledWith('product:p1')
    })

    it('returns data from L2 and populates L1', async () => {
      const data = item()
      redis.get.mockResolvedValue(JSON.stringify(data))
      const result = await cache.getProduct('p1')
      expect(result).toEqual(data)
      expect(cache.l1.has('p1')).toBe(true)
    })

    it('returns data from L1 without calling Redis', async () => {
      const data = item()
      await cache.setProduct('p1', data)
      redis.get.mockClear()
      const result = await cache.getProduct('p1')
      expect(result).toEqual(data)
      expect(redis.get).not.toHaveBeenCalled()
    })

    it('increments frequency on L1 hit', async () => {
      const data = item()
      await cache.setProduct('p1', data)
      await cache.getProduct('p1')
      await cache.getProduct('p1')
      expect(cache.l1.get('p1')!.frequency).toBe(3) // 1 from set + 2 reads
    })

    it('re-fetches from L2 when L1 entry is expired', async () => {
      const data = item()
      cache.l1.set('p1', { data, expiresAt: Date.now() - 1, frequency: 1 })
      redis.get.mockResolvedValue(JSON.stringify(data))
      const result = await cache.getProduct('p1')
      expect(result).toEqual(data)
      expect(redis.get).toHaveBeenCalled()
    })

    it('returns null and does not throw when Redis throws', async () => {
      redis.get.mockRejectedValue(new Error('connection refused'))
      const result = await cache.getProduct('p1')
      expect(result).toBeNull()
    })
  })

  describe('setProduct', () => {
    it('sets L1 and calls Redis SET with EX', async () => {
      const data = item()
      await cache.setProduct('p1', data)
      expect(cache.l1.has('p1')).toBe(true)
      expect(redis.set).toHaveBeenCalledWith('product:p1', JSON.stringify(data), 'EX', expect.any(Number))
      const ttl = (redis.set.mock.calls[0] as unknown[])[3] as number
      expect(ttl).toBeGreaterThanOrEqual(590)
      expect(ttl).toBeLessThanOrEqual(609)
    })

    it('does not throw when Redis SET fails', async () => {
      redis.set.mockRejectedValue(new Error('OOM'))
      await expect(cache.setProduct('p1', item())).resolves.not.toThrow()
    })
  })

  describe('L1 LFU eviction', () => {
    it('evicts lowest-frequency entry when L1 reaches 1000 entries', async () => {
      // Fill L1 with 1000 entries, all frequency=1 except 'low-freq' with frequency=0
      // We directly manipulate l1 for speed
      for (let i = 0; i < 999; i++) {
        cache.l1.set(`x${i}`, { data: item({ id: `x${i}` }), expiresAt: Date.now() + 999999, frequency: 2 })
      }
      // Add low-frequency entry
      cache.l1.set('low-freq', { data: item({ id: 'low-freq' }), expiresAt: Date.now() + 999999, frequency: 0 })
      expect(cache.l1.size).toBe(1000)

      // Adding a new entry triggers eviction of 'low-freq'
      await cache.setProduct('new-entry', item({ id: 'new-entry' }))
      expect(cache.l1.size).toBe(1000)
      expect(cache.l1.has('low-freq')).toBe(false)
      expect(cache.l1.has('new-entry')).toBe(true)
    })
  })

  describe('getL1Ids / setL1Ids', () => {
    it('returns null when no IDs stored', () => {
      expect(cache.getL1Ids()).toBeNull()
    })

    it('returns ids after setL1Ids', () => {
      cache.setL1Ids(['a', 'b'])
      expect(cache.getL1Ids()).toEqual(['a', 'b'])
    })

    it('returns null after L1 IDs expire', () => {
      cache.setL1Ids(['a'])
      // Manually expire
      ;(cache as unknown as { l1IdsEntry: { expiresAt: number } }).l1IdsEntry!.expiresAt = Date.now() - 1
      expect(cache.getL1Ids()).toBeNull()
    })
  })

  describe('getRedisIds', () => {
    it('returns ids from ZREVRANGE', async () => {
      redis.zrevrange.mockResolvedValue(['id2', 'id1'])
      const result = await cache.getRedisIds()
      expect(result).toEqual(['id2', 'id1'])
    })

    it('returns null when ZREVRANGE is empty', async () => {
      redis.zrevrange.mockResolvedValue([])
      expect(await cache.getRedisIds()).toBeNull()
    })

    it('returns null and does not throw on Redis error', async () => {
      redis.zrevrange.mockRejectedValue(new Error('NOCONN'))
      expect(await cache.getRedisIds()).toBeNull()
    })
  })

  describe('getTotal', () => {
    it('returns count from ZCARD', async () => {
      redis.zcard.mockResolvedValue(42)
      expect(await cache.getTotal()).toBe(42)
    })

    it('returns null when ZCARD returns 0', async () => {
      redis.zcard.mockResolvedValue(0)
      expect(await cache.getTotal()).toBeNull()
    })
  })

  describe('setRedisIds', () => {
    it('calls pipeline ZADD for each product', async () => {
      const products = [{ id: 'p1', score: 1000 }, { id: 'p2', score: 2000 }]
      await cache.setRedisIds(products)
      expect(redis.pipeline).toHaveBeenCalled()
      expect(redis._pipeline.zadd).toHaveBeenCalledTimes(2)
      expect(redis._pipeline.zadd).toHaveBeenCalledWith('products:sorted', 1000, 'p1')
      expect(redis._pipeline.zadd).toHaveBeenCalledWith('products:sorted', 2000, 'p2')
    })

    it('no-ops when products array is empty', async () => {
      await cache.setRedisIds([])
      expect(redis.pipeline).not.toHaveBeenCalled()
    })
  })

  describe('addToSortedSet', () => {
    it('calls ZADD with score and id', async () => {
      await cache.addToSortedSet('p1', 1234567890)
      expect(redis.zadd).toHaveBeenCalledWith('products:sorted', 1234567890, 'p1')
    })

    it('does not throw when Redis fails', async () => {
      redis.zadd.mockRejectedValue(new Error('NOCONN'))
      await expect(cache.addToSortedSet('p1', 1000)).resolves.not.toThrow()
    })
  })

  describe('updateProduct (IProductCacheUpdater)', () => {
    it('updates sku/name/price and preserves availableQuantity on cache hit', async () => {
      const original = item({ availableQuantity: 50 })
      cache.l1.set('p1', { data: original, expiresAt: Date.now() + 999999, frequency: 1 })
      await cache.updateProduct('p1', { sku: 'NEW', name: 'New Name', price: 99.9, updatedAt: new Date() })
      const updated = cache.l1.get('p1')!.data
      expect(updated.sku).toBe('NEW')
      expect(updated.name).toBe('New Name')
      expect(updated.price).toBe(99.9)
      expect(updated.availableQuantity).toBe(50)
    })

    it('calls addToSortedSet and does not set product key on cache miss', async () => {
      const updatedAt = new Date(1_700_000_000_000)
      await cache.updateProduct('p1', { sku: 'SKU', name: 'N', price: 1, updatedAt })
      expect(redis.zadd).toHaveBeenCalledWith('products:sorted', updatedAt.getTime(), 'p1')
      expect(redis.set).not.toHaveBeenCalled()
    })
  })

  describe('updateAvailableQuantity (IProductCacheUpdater)', () => {
    it('increments availableQuantity by delta on cache hit', async () => {
      cache.l1.set('p1', { data: item({ availableQuantity: 5 }), expiresAt: Date.now() + 999999, frequency: 1 })
      await cache.updateAvailableQuantity('p1', 3)
      expect(cache.l1.get('p1')!.data.availableQuantity).toBe(8)
    })

    it('no-ops on cache miss', async () => {
      await cache.updateAvailableQuantity('p1', 10)
      expect(redis.set).not.toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/modules/catalog/cache/product-cache-service.spec.ts
```

Expected: all tests fail with "Cannot find module"

- [ ] **Step 3: Create the interface file**

`src/modules/erp-adapter/repositories/product-cache-updater.ts`:

```typescript
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

- [ ] **Step 4: Implement ProductCacheService**

`src/modules/catalog/cache/product-cache-service.ts`:

```typescript
import type { Redis } from 'ioredis'
import type { ProductResponseItem } from '../dtos/list-products-dto'
import type { IProductCacheUpdater } from '@modules/erp-adapter/repositories/product-cache-updater'
import { logger } from '@shared/observability/logger'

interface L1Entry {
  data: ProductResponseItem
  expiresAt: number
  frequency: number
}

const L1_MAX = 1000

function jitteredTtlMs(): number {
  return (600 + Math.floor(Math.random() * 20) - 10) * 1000
}

function jitteredTtlSec(): number {
  return 600 + Math.floor(Math.random() * 20) - 10
}

export class ProductCacheService implements IProductCacheUpdater {
  readonly l1 = new Map<string, L1Entry>()
  private l1IdsEntry: { ids: string[]; expiresAt: number } | null = null

  constructor(readonly redis: Redis) {}

  private evictLFU(): void {
    let minFreq = Infinity
    let minKey = ''
    for (const [key, entry] of this.l1) {
      if (entry.frequency < minFreq) {
        minFreq = entry.frequency
        minKey = key
      }
    }
    if (minKey) this.l1.delete(minKey)
  }

  private writeL1(id: string, data: ProductResponseItem): void {
    if (this.l1.size >= L1_MAX && !this.l1.has(id)) this.evictLFU()
    this.l1.set(id, { data, expiresAt: Date.now() + jitteredTtlMs(), frequency: 1 })
  }

  async getProduct(id: string): Promise<ProductResponseItem | null> {
    const entry = this.l1.get(id)
    if (entry) {
      if (entry.expiresAt > Date.now()) {
        entry.frequency++
        return entry.data
      }
      this.l1.delete(id)
    }
    try {
      const raw = await this.redis.get(`product:${id}`)
      if (!raw) return null
      const data = JSON.parse(raw) as ProductResponseItem
      this.writeL1(id, data)
      return data
    } catch (err) {
      logger.warn({ id, err }, 'cache.l2.get.error')
      return null
    }
  }

  async setProduct(id: string, data: ProductResponseItem): Promise<void> {
    this.writeL1(id, data)
    try {
      await this.redis.set(`product:${id}`, JSON.stringify(data), 'EX', jitteredTtlSec())
    } catch (err) {
      logger.warn({ id, err }, 'cache.l2.set.error')
    }
  }

  getL1Ids(): string[] | null {
    if (this.l1IdsEntry && this.l1IdsEntry.expiresAt > Date.now()) {
      return this.l1IdsEntry.ids
    }
    this.l1IdsEntry = null
    return null
  }

  setL1Ids(ids: string[]): void {
    this.l1IdsEntry = { ids, expiresAt: Date.now() + jitteredTtlMs() }
  }

  async getRedisIds(): Promise<string[] | null> {
    try {
      const ids = await this.redis.zrevrange('products:sorted', 0, -1)
      return ids.length ? ids : null
    } catch (err) {
      logger.warn({ err }, 'cache.l2.getids.error')
      return null
    }
  }

  async setRedisIds(products: Array<{ id: string; score: number }>): Promise<void> {
    if (!products.length) return
    try {
      const pipeline = this.redis.pipeline()
      for (const p of products) {
        pipeline.zadd('products:sorted', p.score, p.id)
      }
      await pipeline.exec()
    } catch (err) {
      logger.warn({ err }, 'cache.l2.setids.error')
    }
  }

  async addToSortedSet(id: string, score: number): Promise<void> {
    try {
      await this.redis.zadd('products:sorted', score, id)
    } catch (err) {
      logger.warn({ id, err }, 'cache.l2.zadd.error')
    }
  }

  async getTotal(): Promise<number | null> {
    try {
      const count = await this.redis.zcard('products:sorted')
      return count > 0 ? count : null
    } catch (err) {
      logger.warn({ err }, 'cache.l2.total.error')
      return null
    }
  }

  async updateProduct(id: string, data: { sku: string; name: string; price: number; updatedAt: Date }): Promise<void> {
    const existing = await this.getProduct(id)
    if (!existing) {
      await this.addToSortedSet(id, data.updatedAt.getTime())
      return
    }
    await this.setProduct(id, { ...existing, sku: data.sku, name: data.name, price: data.price })
  }

  async updateAvailableQuantity(productId: string, delta: number): Promise<void> {
    const existing = await this.getProduct(productId)
    if (!existing) return
    await this.setProduct(productId, { ...existing, availableQuantity: existing.availableQuantity + delta })
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx vitest run src/modules/catalog/cache/product-cache-service.spec.ts
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/modules/erp-adapter/repositories/product-cache-updater.ts src/modules/catalog/cache/product-cache-service.ts src/modules/catalog/cache/product-cache-service.spec.ts
git commit -m "feat: add IProductCacheUpdater port and ProductCacheService (L1 LFU + L2 Redis)"
```

---

