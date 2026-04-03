import { supabase } from '@/lib/supabase'
import { redirect, notFound } from 'next/navigation'
import StandaloneVideoPage from '@/components/VideoFeed/StandaloneVideoPage'
import { Metadata, ResolvingMetadata } from 'next'
import { cache } from 'react'

interface VideoPageProps {
  params: {
    username: string
    id: string
  }
}

/** 
 * 🚀 OPTIMISATION GRADE 10/10 (ELITE)
 * Utilisation de React 'cache' pour mémoriser la requête Supabase.
 * generateMetadata et la Page partageront les données sans doubler les appels DB.
 */
const getCachedVideo = cache(async (id: string) => {
  return await supabase
    .from('videos')
    .select(`
      id, user_id, created_at, video_url, caption, music_name, views_count, 
      likes_count, comments_count, bookmarks_count, slug, thumbnail_url,
      users:user_id (id, username, display_name, avatar_url, bio)
    `)
    .or(`slug.eq.${id},id.eq.${id}`)
    .single()
})

// 🌐 ÉTAPE 1 : SEO & Open Graph (Utilise le cache)
export async function generateMetadata({ params }: VideoPageProps, _parent: ResolvingMetadata): Promise<Metadata> {
  const { id } = params
  const { data } = await getCachedVideo(id)

  if (!data) return { title: 'Vidéo introuvable | TikTok Clone' }

  const user = Array.isArray(data.users) ? data.users[0] : data.users
  const usernameFromDb = `@${user?.username || 'Utilisateur'}`
  
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

// 🛡️ ÉTAPE 2 : Moteur de rendu (Récupère les mêmes données DEPUIS LE CACHE)
export default async function OfficialTikTokVideoPage({ params }: VideoPageProps) {
  const { username, id } = params
  
  const decodedUsername = decodeURIComponent(username)
  if (!decodedUsername.startsWith('@')) return notFound()

  const { data: videoData, error } = await getCachedVideo(id)

  if (error || !videoData) return redirect('/')

  // Normalisation
  const video = {
    ...videoData,
    users: Array.isArray(videoData.users) ? videoData.users[0] : videoData.users
  }

  // Vérification canonique
  const realUsername = `@${video.users?.username}`
  if (decodedUsername.toLowerCase() !== realUsername.toLowerCase()) {
    return redirect(`/${realUsername}/video/${video.slug || video.id}`)
  }

  return (
    <div className="fixed inset-0 bg-black">
       <StandaloneVideoPage initialVideo={video as any} />
    </div>
  )
}
