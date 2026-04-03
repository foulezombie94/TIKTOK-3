/**
 * Token Bucket Rate Limiter — Pilier 3: Sécurité (v3 - Production)
 * 
 * Architecture:
 * 1. Redis (Upstash) primary: Persistent, cross-instance, survives restarts
 * 2. In-memory fallback: If Redis is unavailable, fall back gracefully
 * 3. Hardware fingerprint support: Rate limit by fingerprint, not just IP
 * 
 * Note: Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in env
 * to enable Redis. Without them, the system falls back to in-memory.
 */

// =============================================
// TYPES
// =============================================

interface RateLimitConfig {
  maxTokens: number    // Max burst capacity
  refillRate: number   // Tokens added per second
  windowMs?: number    // Optional: fixed window size for Redis
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs?: number
  limit: number
  backend: 'redis' | 'memory'
}

// =============================================
// ENDPOINT CONFIGS
// =============================================

const LIMITS: Record<string, RateLimitConfig> = {
  'api:general':     { maxTokens: 30,  refillRate: 5 },
  'api:feed':        { maxTokens: 20,  refillRate: 4 },
  'api:comment':     { maxTokens: 3,   refillRate: 0.1 }, // Hardcore: 1 comment per 10s
  'api:upload':      { maxTokens: 2,   refillRate: 0.02 }, // Very strict: 1 upload per 50s
  'api:auth':        { maxTokens: 5,   refillRate: 0.1 },
  'api:like':        { maxTokens: 10,  refillRate: 0.5 }, // 1 like per 2s
  'api:search':      { maxTokens: 10,  refillRate: 2 },
  'api:gift':        { maxTokens: 5,   refillRate: 0.2 },
  'api:webhook':     { maxTokens: 100, refillRate: 50 },
}

// =============================================
// REDIS ADAPTER (Upstash REST API — Edge compatible)
// =============================================

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

/**
 * Execute a Redis command via Upstash REST API.
 * Returns null on failure (triggers fallback to in-memory).
 */
async function redisCommand(command: string[]): Promise<any | null> {
  if (!REDIS_URL || !REDIS_TOKEN) return null

  try {
    const resp = await fetch(`${REDIS_URL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(2000), // 2s timeout — don't block the request
    })

    if (!resp.ok) return null
    const data = await resp.json()
    return data.result
  } catch {
    return null
  }
}

/**
 * Check rate limit using Redis (Token Bucket via Lua script).
 * 
 * The Lua script runs atomically on Redis:
 * 1. Get current bucket state
 * 2. Refill tokens based on elapsed time
 * 3. Try to consume a token
 * 4. Return [allowed, remaining, resetMs]
 */
async function checkRedisRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<RateLimitResult | null> {
  if (!REDIS_URL || !REDIS_TOKEN) return null

  const key = `rl:${endpoint}:${identifier}`
  const now = Date.now()
  const ttlSeconds = Math.ceil(config.maxTokens / config.refillRate) + 10

  // Lua script for atomic Token Bucket
  const luaScript = `
    local key = KEYS[1]
    local maxTokens = tonumber(ARGV[1])
    local refillRate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local ttl = tonumber(ARGV[4])

    local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
    local tokens = tonumber(bucket[1])
    local lastRefill = tonumber(bucket[2])

    if tokens == nil then
      tokens = maxTokens
      lastRefill = now
    end

    local elapsed = (now - lastRefill) / 1000
    tokens = math.min(maxTokens, tokens + elapsed * refillRate)
    lastRefill = now

    local allowed = 0
    if tokens >= 1 then
      tokens = tokens - 1
      allowed = 1
    end

    redis.call('HMSET', key, 'tokens', tostring(tokens), 'lastRefill', tostring(lastRefill))
    redis.call('EXPIRE', key, ttl)

    return {allowed, math.floor(tokens)}
  `

  try {
    const result = await redisCommand([
      'EVAL', luaScript, '1', key,
      config.maxTokens.toString(),
      config.refillRate.toString(),
      now.toString(),
      ttlSeconds.toString(),
    ])

    if (result && Array.isArray(result)) {
      const allowed = result[0] === 1
      const remaining = result[1]

      return {
        allowed,
        remaining,
        retryAfterMs: allowed ? undefined : Math.ceil((1 / config.refillRate) * 1000),
        limit: config.maxTokens,
        backend: 'redis',
      }
    }
  } catch {
    // Redis failed — will fallback to in-memory
  }

  return null
}

// =============================================
// IN-MEMORY FALLBACK
// =============================================

interface MemoryBucket {
  tokens: number
  lastRefill: number
}

const memoryBuckets = new Map<string, MemoryBucket>()
let lastCleanup = Date.now()
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
const BUCKET_MAX_AGE_MS = 10 * 60 * 1000

function cleanupMemoryBuckets() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now

  const keysToDelete: string[] = []
  memoryBuckets.forEach((bucket, key) => {
    if (now - bucket.lastRefill > BUCKET_MAX_AGE_MS) {
      keysToDelete.push(key)
    }
  })
  keysToDelete.forEach(key => memoryBuckets.delete(key))
}

function checkMemoryRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupMemoryBuckets()

  const key = `${endpoint}:${identifier}`
  const now = Date.now()

  let bucket = memoryBuckets.get(key)
  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: now }
    memoryBuckets.set(key, bucket)
  }

  const elapsed = (now - bucket.lastRefill) / 1000
  bucket.tokens = Math.min(config.maxTokens, bucket.tokens + elapsed * config.refillRate)
  bucket.lastRefill = now

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      limit: config.maxTokens,
      backend: 'memory',
    }
  }

  const tokensNeeded = 1 - bucket.tokens
  const retryAfterMs = Math.ceil((tokensNeeded / config.refillRate) * 1000)

  return {
    allowed: false,
    remaining: 0,
    retryAfterMs,
    limit: config.maxTokens,
    backend: 'memory',
  }
}

// =============================================
// PUBLIC API
// =============================================

/**
 * Build the best available identifier for rate limiting.
 * 
 * Priority: Hardware fingerprint > User ID > IP address
 * This prevents attackers from bypassing limits by switching IPs.
 * 
 * @param req - The incoming request
 * @param userId - Optional authenticated user ID
 * @param fingerprint - Optional client hardware fingerprint
 */
export function buildIdentifier(
  req: Request,
  userId?: string | null,
  fingerprint?: string | null
): string {
  // 1. Hardware fingerprint (most reliable, hardest to spoof)
  if (fingerprint && fingerprint.length >= 8) {
    return `fp:${fingerprint}`
  }

  // 2. Authenticated user ID
  if (userId) {
    return `uid:${userId}`
  }

  // 3. IP address (fallback — can be shared or spoofed via proxies)
  return `ip:${getClientIP(req)}`
}

/**
 * Check if a request is allowed under the rate limit.
 * 
 * Uses Redis (Upstash) if available, falls back to in-memory.
 * 
 * @param identifier - Built via buildIdentifier() or raw IP/userId
 * @param endpoint - Endpoint category key (e.g., 'api:comment')
 */
export async function checkRateLimit(identifier: string, endpoint: string): Promise<RateLimitResult> {
  const config = LIMITS[endpoint] || LIMITS['api:general']

  // Try Redis first (persistent, cross-instance)
  if (REDIS_URL && REDIS_TOKEN) {
    const redisResult = await checkRedisRateLimit(identifier, endpoint, config)
    if (redisResult) return redisResult
    // Redis failed — fall through to in-memory
  }

  // Fallback: in-memory (per-instance, volatile)
  return checkMemoryRateLimit(identifier, endpoint, config)
}

/**
 * Synchronous rate limit check (in-memory only).
 * Use this in Edge Middleware where async Redis calls add too much latency.
 */
export function checkRateLimitSync(identifier: string, endpoint: string): RateLimitResult {
  const config = LIMITS[endpoint] || LIMITS['api:general']
  return checkMemoryRateLimit(identifier, endpoint, config)
}

/**
 * Get rate limit headers for HTTP response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Backend': result.backend,
  }

  if (!result.allowed && result.retryAfterMs) {
    headers['Retry-After'] = Math.ceil(result.retryAfterMs / 1000).toString()
    headers['X-RateLimit-Reset'] = new Date(Date.now() + result.retryAfterMs).toISOString()
  }

  return headers
}

/**
 * Extract client IP from request (works with Vercel / Cloudflare / Nginx)
 */
export function getClientIP(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

/**
 * Classify a URL path into a rate limit endpoint category
 */
export function classifyEndpoint(pathname: string): string {
  if (pathname.includes('/api/auth') || pathname.includes('/auth/')) return 'api:auth'
  if (pathname.includes('/api/upload') || pathname.includes('/upload')) return 'api:upload'
  if (pathname.includes('/api/videos/comment') || pathname.includes('/comment')) return 'api:comment'
  if (pathname.includes('/api/videos/like') || pathname.includes('/like')) return 'api:like'
  if (pathname.includes('/api/feed') || pathname === '/') return 'api:feed'
  if (pathname.includes('/api/search') || pathname.includes('/discover')) return 'api:search'
  if (pathname.includes('/api/gift') || pathname.includes('/gift')) return 'api:gift'
  if (pathname.includes('/api/webhook')) return 'api:webhook'
  return 'api:general'
}
