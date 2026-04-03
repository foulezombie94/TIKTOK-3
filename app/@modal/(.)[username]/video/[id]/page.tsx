import { supabase } from '@/lib/supabase'
import VideoModal from '@/components/VideoFeed/VideoModal'
import { notFound } from 'next/navigation'

interface InterceptedVideoPageProps {
  params: {
    username: string
    id: string
  }
}

/**
 * 💎 INTERCEPTEUR MODAL (Official TikTok Style)
 * Permet d'ouvrir /@username/video/id dans une modal sans quitter le feed actuel.
 */
export default async function InterceptedOfficialVideoPage({ params }: InterceptedVideoPageProps) {
  const { username, id } = params

  const decodedUsername = decodeURIComponent(username)
  if (!decodedUsername.startsWith('@')) return null

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

  if (error || !videoData) return null

  // 2. Normalisation
  const video = {
    ...videoData,
    users: Array.isArray(videoData.users) ? videoData.users[0] : videoData.users
  }

  // 3. Validation du propriétaire (Empêche l'affichage si le pseudo URL ne matche pas)
  const realUsername = `@${video.users?.username}`
  if (decodedUsername.toLowerCase() !== realUsername.toLowerCase()) return null

  return <VideoModal video={video} />
}
