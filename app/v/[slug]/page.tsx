import { supabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import StandaloneVideoPage from '@/components/VideoFeed/StandaloneVideoPage'
import { Metadata, ResolvingMetadata } from 'next'

interface VideoPageProps {
  params: { slug: string }
}

// 🌐 ÉTAPE 1 : SEO & Open Graph (Aperçus Discord, Twitter, iMessage)
export async function generateMetadata({ params }: VideoPageProps, _parent: ResolvingMetadata): Promise<Metadata> {
  const { slug } = params
  
  const { data } = await supabase
    .from('videos')
    .select('caption, thumbnail_url, users:user_id(username)')
    .eq('slug', slug)
    .single()

  if (!data) return { title: 'Vidéo introuvable | TikTok Clone' }

  const user = Array.isArray(data.users) ? data.users[0] : data.users
  const username = user?.username || 'Utilisateur'
  const title = `Vidéo de @${username} | TikTok Clone`
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

// 🛡️ ÉTAPE 2 : Moteur de rendu et Redirection Sécurisée
export default async function ShortUrlDirectPage({ params }: VideoPageProps) {
  const { slug } = params

  // 1. Recherche via le Slug (Priorité)
  const { data: videoData, error: slugError } = await supabase
    .from('videos')
    .select(`
      id, video_url, caption, music_name, views_count, 
      likes_count, comments_count, bookmarks_count, slug, thumbnail_url,
      users:user_id (id, username, display_name, avatar_url, bio)
    `)
    .eq('slug', slug)
    .single()

  let finalVideoData = videoData

  // 2. Fallback Sécurisé si le slug n'existe pas
  if (slugError || !finalVideoData) {
    // 🛡️ SECURITY: Regex UUID stricte pour empêcher les injections
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug)
    
    if (!isUUID) redirect('/')

    const { data: fallbackData } = await supabase
      .from('videos')
      .select(`
        id, video_url, caption, music_name, views_count, 
        likes_count, comments_count, bookmarks_count, slug, thumbnail_url,
        users:user_id (id, username, display_name, avatar_url, bio)
      `)
      .eq('id', slug)
      .single()
    
    if (!fallbackData) redirect('/')

    finalVideoData = fallbackData
  }

  // 3. Normalisation des données utilisateur
  const video = {
    ...finalVideoData,
    users: Array.isArray(finalVideoData.users) ? finalVideoData.users[0] : finalVideoData.users
  }

  return <StandaloneVideoPage initialVideo={video} />
}
