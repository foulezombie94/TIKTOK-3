import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  // Rafraîchir dynamiquement les cookies de session pour les requêtes RSC
  const res = await updateSession(req)
  
  // Utilisation d'un client temporaire uniquement pour lire le statut Auth depuis le Request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() }
      }
    }
  )

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
