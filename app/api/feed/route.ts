/**
 * Feed API Route — Pilier 1+2: Performance & Scalabilité (v2 - Hardcore)
 * 
 * - Shared cache key for anonymous users (prevents cache fragmentation)
 * - Strict parameter validation (cursor ISO, userId UUID)
 * - Prefetch hints for client
 * - withTiming for DB call measurement
 * - Anti-stampede via cache.getOrSet
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { feedCache, CacheKeys } from '@/lib/cache'
import { createLogger, generateCorrelationId, withTiming } from '@/lib/logger'
import { checkRateLimit, getRateLimitHeaders, buildIdentifier } from '@/lib/rate-limiter'
import { isValidUUID, isValidISOTimestamp } from '@/lib/sanitize'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const correlationId = req.headers.get('x-correlation-id') || generateCorrelationId()
  const log = createLogger({ correlationId, path: '/api/feed' })
  const start = Date.now()

  // === Rate limiting (Redis-first, with fingerprint support) ===
  const fingerprint = req.headers.get('x-device-fingerprint') || null
  const identifier = buildIdentifier(req, null, fingerprint)
  const rateLimit = await checkRateLimit(identifier, 'api:feed')
  if (!rateLimit.allowed) {
    log.warn('Rate limit exceeded for feed', { identifier, backend: rateLimit.backend })
    return NextResponse.json(
      { error: 'Trop de requêtes. Réessayez plus tard.' },
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    )
  }

  try {
    const url = new URL(req.url)
    const rawCursor = url.searchParams.get('cursor') || null
    const rawCursorId = url.searchParams.get('cursor_id') || null
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '10') || 10, 1), 20)
    const rawUserId = url.searchParams.get('user_id') || null

    // === Strict parameter validation ===
    const cursor = rawCursor && isValidISOTimestamp(rawCursor) ? rawCursor : null
    const cursorId = rawCursorId && isValidUUID(rawCursorId) ? rawCursorId : null
    const userId = rawUserId && isValidUUID(rawUserId) ? rawUserId : null

    if (rawCursor && !cursor) {
      return NextResponse.json({ error: 'Invalid cursor format' }, { status: 400 })
    }
    if (rawUserId && !userId) {
      return NextResponse.json({ error: 'Invalid user_id format' }, { status: 400 })
    }

    // === Cache with anti-stampede (shared key for anon) ===
    const cacheKey = CacheKeys.feedPage(userId || 'anon', cursor || 'latest', limit)

    const data = await feedCache.getOrSet(
      cacheKey,
      async () => {
        const supabase = createClient()

        // Try RPC first with timing
        const result = await withTiming('feed_rpc', async () => {
          return supabase.rpc('get_fyp_videos', {
            p_user_id: userId || '00000000-0000-0000-0000-000000000000',
            p_offset: 0,
            p_limit: limit,
          })
        }, log)

        if (result.error || !result.data) {
          log.warn('Feed RPC failed, using fallback', { error: result.error?.message })

          // Fallback with timing
          const fallback = await withTiming('feed_fallback_query', async () => {
            return supabase
              .from('videos')
              .select(`*, users (id, username, display_name, avatar_url)`)
              .order('created_at', { ascending: false })
              .limit(limit)
          }, log)

          if (fallback.error) throw new Error(fallback.error.message)
          return fallback.data || []
        }

        return result.data
      },
      30 // TTL: 30 seconds
    )

    const durationMs = Date.now() - start
    log.info('Feed served', { durationMs, count: (data as any[]).length })

    const videos = data as any[]
    const lastVideo = videos.length > 0 ? videos[videos.length - 1] : null

    return NextResponse.json({
      data: videos,
      nextCursor: lastVideo?.created_at || null,
      nextCursorId: lastVideo?.id || null,
      hasMore: videos.length === limit,
      // Prefetch hint: client can start loading next batch in background
      prefetchHint: videos.length === limit ? 'prefetch-next' : null,
      cached: feedCache.get(cacheKey) !== undefined,
    }, {
      headers: {
        ...getRateLimitHeaders(rateLimit),
        'X-Correlation-ID': correlationId,
        'X-Response-Time': `${durationMs}ms`,
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      }
    })

  } catch (err) {
    const durationMs = Date.now() - start
    log.error('Feed API error', err as Error, { durationMs })
    return NextResponse.json(
      { error: 'Erreur lors du chargement du feed' },
      { status: 500, headers: { 'X-Correlation-ID': correlationId } }
    )
  }
}
