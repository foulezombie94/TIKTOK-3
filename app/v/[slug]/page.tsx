import { supabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'

interface VideoPageProps {
  params: { slug: string }
}

/** 
 * 👋 ROU-RÉTROCOMPATIBILITÉ (v301)
 * Redirige les anciens liens /v/slug vers le format TikTok Officiel : /@username/video/id
 * Indispensable pour le SEO et le partage fluide.
 */
export default async function LegacyVideoRedirectPage({ params }: VideoPageProps) {
  const { slug } = params

  // 1. Recherche via le Slug ou ID (Le système supporte les deux pour la résilience)
  const { data: videoData, error } = await supabase
    .from('videos')
    .select(`
      id, slug,
      users:user_id (username)
    `)
    .or(`slug.eq.${slug},id.eq.${slug}`)
    .single()

  if (error || !videoData) {
    return redirect('/')
  }

  // 2. Normalisation des données
  const user = Array.isArray(videoData.users) ? videoData.users[0] : videoData.users
  const username = user?.username || 'Utilisateur'
  const finalId = videoData.slug || videoData.id

  // 3. Redirection permanente
  return redirect(`/@${username}/video/${finalId}`)
}

// SEO : On garde quand même les metadata temporaires si besoin (ou on redirige direct)
export async function generateMetadata({ params }: VideoPageProps) {
  return { title: 'Redirection...' }
}
