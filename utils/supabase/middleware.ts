import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // 1. Client Auth (pour refresh session itératif)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Rafraîchir la session via Auth
  const { data: { user } } = await supabase.auth.getUser()

  // 2. BAN ENFORCEMENT INSTANTANÉ (Via JWT Custom Claims — Zéro DB hit)
  if (user) {
    const isBannedPage = request.nextUrl.pathname.startsWith('/banned')
    
    if (!isBannedPage) {
      // Lecture ultra-rapide des claims injectés par le Trigger SQL 'trg_sync_user_metadata'
      const status = (user.app_metadata?.status as string) || 'active'
      const banReason = (user.app_metadata?.ban_reason as string) || ''

      if (status.toLowerCase() === 'banned') {
        console.warn(`[BAN ENFORCED] Blocking user ${user.id} via JWT Claims`);
        const url = request.nextUrl.clone()
        url.pathname = '/banned'
        if (banReason) {
          url.searchParams.set('reason', banReason)
        }
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
