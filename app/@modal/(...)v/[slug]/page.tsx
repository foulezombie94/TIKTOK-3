import { supabase } from '@/lib/supabase'
import VideoModal from '@/components/VideoFeed/VideoModal'
import { notFound } from 'next/navigation'

interface InterceptedVideoPageProps {
  params: {
    slug: string
  }
}

export default async function InterceptedVideoPage({ params }: InterceptedVideoPageProps) {
  const { slug } = params

  // 1. Double tentative (Slug d'abord, puis UUID)
  // Recherche par l'identifiant le plus probable (Slug à 8 caractères)
  const { data: videoData, error } = await supabase
    .from('videos')
    .select(`
      id, video_url, caption, music_name, views_count, 
      likes_count, comments_count, bookmarks_count, slug, thumbnail_url,
      users:user_id (id, username, display_name, avatar_url, bio)
    `)
    .eq('slug', slug)
    .single()

  let finalVideoData = videoData

  // 2. Fallback UUID si pas trouvé par slug
  if (error || !finalVideoData) {
    // SECURITY: Regex UUID v4 standard (modérément souple pour capter tous les IDs)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
    
    if (!isUUID) return null // Pas d'interception si pas d'ID valide

    const { data: fallbackData } = await supabase
      .from('videos')
      .select(`
        id, video_url, caption, music_name, views_count, 
        likes_count, comments_count, bookmarks_count, slug, thumbnail_url,
        users:user_id (id, username, display_name, avatar_url, bio)
      `)
      .eq('id', slug)
      .single()
    
    if (!fallbackData) return null

    finalVideoData = fallbackData
  }

  // 3. Normalisation des données utilisateur
  const video = {
    ...finalVideoData,
    users: Array.isArray(finalVideoData.users) ? finalVideoData.users[0] : finalVideoData.users
  }

  return <VideoModal video={video} />
}
