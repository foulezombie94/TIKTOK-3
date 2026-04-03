import { supabase } from '@/lib/supabase'
import { redirect, notFound } from 'next/navigation'
import StandaloneVideoPage from '@/components/VideoFeed/StandaloneVideoPage'
import { Metadata, ResolvingMetadata } from 'next'

interface VideoPageProps {
  params: {
    username: string
    id: string
  }
}

// 🌐 SEO & Open Graph (Aperçus Discord, Twitter, etc.)
export async function generateMetadata({ params }: VideoPageProps, _parent: ResolvingMetadata): Promise<Metadata> {
  const { id } = params
  
  // Le paramètre 'id' peut être un slug ou un UUID
  const { data } = await supabase
    .from('videos')
    .select('caption, thumbnail_url, id, slug, users:user_id(username)')
    .or(`slug.eq.${id},id.eq.${id}`)
    .single()

  if (!data) return { title: 'Vidéo introuvable | TikTok Clone' }

  const user = Array.isArray(data.users) ? data.users[0] : data.users
  const usernameFromDb = `@${user?.username || 'Utilisateur'}`
  
  // Optionnel : Redirection si le username dans l'URL ne correspond pas (SEO Canonique)
  // if (decodeURIComponent(params.username) !== usernameFromDb) { ... }

  const title = `Vidéo de ${usernameFromDb} | TikTok Clone`
  const description = data.caption || 'Découvrez cette vidéo sur TikTok Clone'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [data.thumbnail_url || ''],
      type: 'video.other',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [data.thumbnail_url || ''],
    }
  }
}

export default async function OfficialTikTokVideoPage({ params }: VideoPageProps) {
  const { username, id } = params
  
  // 🛡️ SECURITY: Format validation pour le username (doit commencer par @)
  const decodedUsername = decodeURIComponent(username)
  if (!decodedUsername.startsWith('@')) {
    return notFound()
  }

  // 1. Recherche via le Slug ou ID (Le système supporte les deux pour la résilience)
  const { data: videoData, error } = await supabase
    .from('videos')
    .select(`
      id, user_id, created_at, video_url, caption, music_name, views_count, 
      likes_count, comments_count, bookmarks_count, slug, thumbnail_url,
      users:user_id (id, username, display_name, avatar_url, bio)
    `)
    .or(`slug.eq.${id},id.eq.${id}`)
    .single()

  if (error || !videoData) {
    return redirect('/')
  }

  // 2. Normalisation des données
  const video = {
    ...videoData,
    users: Array.isArray(videoData.users) ? videoData.users[0] : videoData.users
  }

  // 3. Vérification de l'appartenance (SEO & TikTok Consistency)
  const realUsername = `@${video.users?.username}`
  if (decodedUsername.toLowerCase() !== realUsername.toLowerCase()) {
    // Redirection vers l'URL canonique si l'utilisateur s'est trompé de pseudo dans l'URL
    return redirect(`/${realUsername}/video/${video.slug || video.id}`)
  }

  return (
    <div className="fixed inset-0 bg-black">
       <StandaloneVideoPage initialVideo={video} />
    </div>
  )
}
