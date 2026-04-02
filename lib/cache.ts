/**
 * In-Memory Cache Layer — Pilier 1: Performance (v2 - Hardcore)
 * 
 * O(1) LRU eviction via Map insertion order.
 * Anti-Stampede protection via Promise deduplication.
 * Compatible with Vercel's serverless environment (per-instance cache).
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

class InMemoryCache {
  private store = new Map<string, CacheEntry<unknown>>()
  // Anti-Stampede: in-flight Promise deduplication
  private inflight = new Map<string, Promise<unknown>>()
  private readonly maxSize: number
  private hits = 0
  private misses = 0

  constructor(maxSize = 1000) {
    this.maxSize = maxSize
  }

  /**
   * Get a cached value. O(1) with LRU refresh (delete + re-insert).
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) {
      this.misses++
      return undefined
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      this.misses++
      return undefined
    }

    // LRU refresh: delete and re-insert to move to end (most recent)
    this.store.delete(key)
    this.store.set(key, entry)

    this.hits++
    return entry.value as T
  }

  /**
   * Set a value in cache with TTL in seconds. O(1) eviction.
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    // If key exists, delete first (will be re-inserted at end)
    if (this.store.has(key)) {
      this.store.delete(key)
    } else if (this.store.size >= this.maxSize) {
      // O(1) eviction: Map.keys().next() returns the oldest (least recently used)
      const oldestKey = this.store.keys().next().value
      if (oldestKey !== undefined) this.store.delete(oldestKey)
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    })
  }

  /**
   * Get or set with Anti-Stampede protection.
   * If two requests hit the same missing key simultaneously,
   * only ONE will call fetcher(). The second waits for the same Promise.
   */
  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number): Promise<T> {
    // 1. Check cache
    const cached = this.get<T>(key)
    if (cached !== undefined) return cached

    // 2. Check if there's already an in-flight request for this key
    const existingPromise = this.inflight.get(key)
    if (existingPromise) {
      return existingPromise as Promise<T>
    }

    // 3. Create new fetch and register it
    const fetchPromise = fetcher()
      .then((value) => {
        this.set(key, value, ttlSeconds)
        this.inflight.delete(key)
        return value
      })
      .catch((err) => {
        this.inflight.delete(key)
        throw err
      })

    this.inflight.set(key, fetchPromise)
    return fetchPromise
  }

  /**
   * Invalidate a specific key
   */
  invalidate(key: string): boolean {
    return this.store.delete(key)
  }

  /**
   * Invalidate all keys matching a prefix
   */
  invalidatePrefix(prefix: string): number {
    let count = 0
    const keysToDelete: string[] = []
    // Collect keys first to avoid modifying Map during iteration
    this.store.forEach((_, key) => {
      if (key.startsWith(prefix)) keysToDelete.push(key)
    })
    keysToDelete.forEach(key => {
      this.store.delete(key)
      count++
    })
    return count
  }

  /**
   * Clear all cache
   */
  flush(): void {
    this.store.clear()
    this.inflight.clear()
    this.hits = 0
    this.misses = 0
  }

  /**
   * Get cache statistics
   */
  stats() {
    const total = this.hits + this.misses
    return {
      size: this.store.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : 'N/A',
      inflightKeys: this.inflight.size,
    }
  }
}

// === Singleton instances per data domain ===

/** Video metadata cache — TTL 10 min */
export const videoCache = new InMemoryCache(500)

/** User profile cache — TTL 5 min */
export const userCache = new InMemoryCache(200)

/** Feed cache — TTL 2 min (shared key for anon users) */
export const feedCache = new InMemoryCache(100)

/** Counter cache (likes, views) — TTL 30 sec */
export const counterCache = new InMemoryCache(1000)

// === Cache Key Generators ===

export const CacheKeys = {
  videoMeta: (videoId: string) => `video:${videoId}:meta`,
  userProfile: (userId: string) => `user:${userId}:profile`,
  userByUsername: (username: string) => `user:username:${username}`,
  feedPage: (userId: string, cursor: string, limit: number) => {
    // Optimization: share cache key for anonymous and non-personalized feeds
    const normalizedUser = (!userId || userId === '00000000-0000-0000-0000-000000000000') ? 'anon' : userId
    return `feed:${normalizedUser}:${cursor}:${limit}`
  },
  videoLikes: (videoId: string) => `video:${videoId}:likes`,
  videoComments: (videoId: string) => `video:${videoId}:comments`,
  videoViews: (videoId: string) => `video:${videoId}:views`,
  trendingVideos: () => `trending:videos`,
  discoverUsers: (query: string) => `discover:${query}`,
  healthCheck: () => `health:supabase`,
} as const
