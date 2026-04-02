/**
 * Edge Middleware — Pilier 3: Sécurité (v2 - Hardcore)
 * 
 * - Whitelisted good bots (Googlebot, Bingbot)
 * - 444-style empty response for bad bots
 * - Admin check via JWT user_metadata (no DB query)
 * - Tighter CSP (removed unsafe-eval where possible)
 * - Correlation IDs + structured access logs
 * - Redis-backed rate limiting (Upstash)
 */

import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { createServerClient } from '@supabase/ssr'
import { checkRateLimit, buildIdentifier, getRateLimitHeaders, classifyEndpoint } from '@/lib/rate-limiter'

// =============================================
// BOT DETECTION
// =============================================

const GOOD_BOT_PATTERNS = [
  /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i,
  /baiduspider/i, /yandexbot/i, /facebot/i, /twitterbot/i,
  /linkedinbot/i, /whatsapp/i, /telegrambot/i,
]

const BAD_BOT_PATTERNS = [
  /scrapy/i, /python-requests/i, /python-urllib/i, /curl\//i,
  /wget\//i, /httpclient/i, /libwww/i, /httpunit/i,
  /nutch/i, /biglotron/i, /teoma/i, /convera/i,
]

function classifyBot(ua: string): 'good' | 'bad' | 'none' {
  if (GOOD_BOT_PATTERNS.some(p => p.test(ua))) return 'good'
  if (BAD_BOT_PATTERNS.some(p => p.test(ua))) return 'bad'
  return 'none'
}

// =============================================
// MIDDLEWARE
// =============================================

export async function middleware(req: NextRequest) {
  // === 1. Context Extraction ===
  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID()
  const ua = req.headers.get('user-agent') || ''
  const botType = classifyBot(ua)
  const hardwareId = req.cookies.get('_tk_dev_id')?.value || null
  
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip')
    || 'unknown'

  // === 2. Bot Protection ===
  if (botType === 'bad' && req.nextUrl.pathname.startsWith('/api/')
    && !req.nextUrl.pathname.startsWith('/api/health')
    && !req.nextUrl.pathname.startsWith('/api/webhook')) {
    return new NextResponse(null, { status: 444, headers: { 'Connection': 'close' } })
  }

  // === 3. Rate Limiting (Redis-backed) ===
  if (req.nextUrl.pathname.startsWith('/api/') && !req.nextUrl.pathname.startsWith('/api/health')) {
    const endpoint = classifyEndpoint(req.nextUrl.pathname)
    const identifier = buildIdentifier(req, null, hardwareId)
    const rateLimit = await checkRateLimit(identifier, endpoint)
    
    if (!rateLimit.allowed) {
      return new NextResponse(
        JSON.stringify({ error: 'Trop de requêtes. Veuillez patienter.' }),
        { 
          status: 429, 
          headers: { 
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId,
            ...getRateLimitHeaders(rateLimit)
          } 
        }
      )
    }
  }

  // === 4. Hardware & IP Ban Check (Edge RPC) ===
  // Note: This is an RPC call to check the blacklist table
  const supabaseMiddleware = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll() } } }
  )

  const { data: isHardwareBanned } = await supabaseMiddleware.rpc('check_is_hardware_banned', {
    p_ip: ip,
    p_hardware_id: hardwareId
  })

  if (isHardwareBanned && !req.nextUrl.pathname.startsWith('/banned-device')) {
    return NextResponse.redirect(new URL('/banned-device', req.url))
  }

  // === 5. Session & Auth Hooks (JWT Clean check inside) ===
  const res = await updateSession(req)
  
  // Return immediately if session refresh triggered a redirect (to /banned)
  if (res.headers.get('location')?.includes('/banned')) {
    return res
  }

  // === 6. Admin Protection (JWT Metadata Check) ===
  if (req.nextUrl.pathname.startsWith('/admin')) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return req.cookies.getAll() } } }
    )

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // Strict JWT-only check (Zero DB hit)
    const isAdmin = session.user.app_metadata?.role === 'admin' 
      || session.user.user_metadata?.role === 'admin'
    
    if (!isAdmin) {
      console.warn(`[ADMIN ACCESS DENIED] User: ${session.user.id}, IP: ${ip}, CID: ${correlationId}`)
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  // === 7. Security Headers ===
  res.headers.set('X-Correlation-ID', correlationId)
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-XSS-Protection', '0')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.headers.set('X-DNS-Prefetch-Control', 'on')
  
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  // Content-Security-Policy
  const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : ''
  const isDev = process.env.NODE_ENV !== 'production'
  const scriptSrc = `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} https://js.stripe.com`

  const csp = [
    "default-src 'self'",
    `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://api.stripe.com https://api.dicebear.com`,
    `img-src 'self' data: blob: https://${supabaseHost} https://api.dicebear.com https://images.unsplash.com`,
    `media-src 'self' blob: https://${supabaseHost}`,
    scriptSrc,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    "frame-src https://js.stripe.com",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join('; ')
  res.headers.set('Content-Security-Policy', csp)

  // === 8. Structured Logging ===
  if (req.nextUrl.pathname.startsWith('/api/')) {
    console.log(JSON.stringify({
      level: 'info',
      msg: 'api_request',
      method: req.method,
      path: req.nextUrl.pathname,
      ip,
      botType,
      correlationId,
      timestamp: new Date().toISOString(),
    }))
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
