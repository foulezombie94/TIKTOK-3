import { supabase } from '@/lib/supabase'
import VideoModal from '@/components/VideoFeed/VideoModal'
import { FeedVideo } from '@/types/video'
import { notFound } from 'next/navigation'

interface InterceptedVideoPageProps {
  params: {
    slug: string
  }
}

export default async function InterceptedVideoPage({ params }: InterceptedVideoPageProps) {
  const { slug } = params

  // 1. Cherche la vidéo par son slug (ou ID si c'est un UUID)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
  
  let query = supabase
    .from('videos')
    .select(`
      id, video_url, caption, music_name, views_count, 
      likes_count, comments_count, bookmarks_count, slug,
      users:user_id (
        id, username, display_name, avatar_url, bio
      )
    `)

  if (isUUID) {
    query = query.eq('id', slug)
  } else {
    query = query.eq('slug', slug)
  }

  const { data: videoData, error } = await query.single()

  if (error || !videoData) {
    // Si pas trouvé par slug, on tente par ID (fallback si slug n'était pas identifié comme UUID mais l'est peut-être)
    const { data: fallbackData } = await supabase
      .from('videos')
      .select(`
        id, video_url, caption, music_name, views_count, 
        likes_count, comments_count, bookmarks_count, slug,
        users:user_id (
          id, username, display_name, avatar_url, bio
        )
      `)
      .eq('id', slug)
      .single()
    
    if (!fallbackData) {
      return null // On ne montre pas d'erreur, on laisse l'app continuer
    }

    const video = {
      ...fallbackData,
      users: Array.isArray(fallbackData.users) ? fallbackData.users[0] : fallbackData.users
    }
    return <VideoModal video={video} />
  }

  const video = {
    ...videoData,
    users: Array.isArray(videoData.users) ? videoData.users[0] : videoData.users
  }

  return <VideoModal video={video} />
}
