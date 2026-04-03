import { supabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import StandaloneVideoPage from '@/components/VideoFeed/StandaloneVideoPage'
import { Metadata } from 'next'

interface VideoPageProps {
  params: {
    slug: string
  }
}

// 🌐 2. SEO & Partage (Open Graph)
export async function generateMetadata({ params }: VideoPageProps): Promise<Metadata> {
  const { slug } = params
  
  const { data } = await supabase
    .from('videos')
    .select('caption, thumbnail_url, users:user_id(username)')
    .eq('slug', slug)
    .single()

  if (!data) return { title: 'Vidéo | TikTok Clone' }

  const user = Array.isArray(data.users) ? data.users[0] : data.users
  const username = user?.username || 'Utilisateur'

  return {
    title: `Vidéo de @${username} | TikTok Clone`,
    description: data.caption || 'Découvrez cette vidéo sur TikTok Clone',
    openGraph: {
      title: `Vidéo de @${username}`,
      description: data.caption || 'Découvrez cette vidéo sur TikTok Clone',
      images: [data.thumbnail_url || ''],
      type: 'video.other',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Vidéo de @${username}`,
      description: data.caption,
      images: [data.thumbnail_url || ''],
    }
  }
}

export default async function ShortUrlDirectPage({ params }: VideoPageProps) {
  const { slug } = params

  // 1. Cherche la vidéo par son slug (priorité)
  const { data: videoData, error } = await supabase
    .from('videos')
    .select(`
      id, video_url, caption, music_name, views_count, 
      likes_count, comments_count, bookmarks_count, slug,
      users:user_id (
        id, username, display_name, avatar_url, bio
      )
    `)
    .eq('slug', slug)
    .single()

  // 🚨 1. Faille de plantage (Fallback UUID Validation)
  if (error || !videoData) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
    
    if (!isUUID) {
      return redirect('/') // Ni slug valide, ni UUID: sécurité
    }

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
    
    if (fallbackData) {
       const video = {
         ...fallbackData,
         users: Array.isArray(fallbackData.users) ? fallbackData.users[0] : fallbackData.users
       }
       return <StandaloneVideoPage initialVideo={video} />
    }

    return redirect('/')
  }

  const video = {
    ...videoData,
    users: Array.isArray(videoData.users) ? videoData.users[0] : videoData.users
  }

  return <StandaloneVideoPage initialVideo={video} />
}
