import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  const { data: { session } } = await supabase.auth.getSession()

  // Protection absolue de l'espace /admin
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!session) return NextResponse.redirect(new URL('/', req.url))
    
    // Vérification rigoureuse dans la table admin_roles - Aucune confiance au client JS local
    const { data: adminCheck } = await supabase
      .from('admin_roles')
      .select('user_id')
      .eq('user_id', session.user.id)
      .single()

    if (!adminCheck) {
      console.warn(`[TENTATIVE ESCALADE PRIVILÈGE] Utilisateur ${session.user.id} a tenté d'accéder à l'Admin.`);
      return NextResponse.redirect(new URL('/', req.url))
    }
  }
  
  return res
}

export const config = {
  matcher: ['/admin/:path*'],
}
