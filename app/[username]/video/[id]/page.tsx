import { supabase } from '@/lib/supabase'
import { redirect, notFound } from 'next/navigation'
import StandaloneVideoPage from '@/components/VideoFeed/StandaloneVideoPage'
import { Metadata, ResolvingMetadata } from 'next'
import { cache } from 'react'
import Link from 'next/link'

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
  const cleanId = id.trim()
  
  try {
    console.log(`🔍 [SERVER FETCH] Tentative de récupération Vidéo: ${cleanId}`)
    
    // 🛡️ ÉTAPE A : Récupération de la vidéo SEULE (pour éviter les échecs de jointure RLS)
    const { data: videoData, error: videoError } = await supabase
      .from('videos')
      .select('id, user_id, created_at, video_url, caption, music_name, views_count, likes_count, comments_count, bookmarks_count, slug, thumbnail_url')
      .or(`slug.eq."${cleanId}",id.eq."${cleanId}"`)
      .single()

    if (videoError || !videoData) {
      console.error("❌ [SERVER FETCH] Échec Vidéo:", videoError?.message)
      return { data: null, error: videoError }
    }

    // 🛡️ ÉTAPE B : Récupération du profil créateur SÉPARÉMENT
    // (Plus résilient si les permissions sur la table 'users' sont restreintes)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, username, display_name, avatar_url, bio')
      .eq('id', videoData.user_id)
      .single()

    if (userError) {
      console.warn("⚠️ [SERVER FETCH] Créateur introuvable ou accès refusé:", userError.message)
    }

    return { 
      data: { 
        ...videoData, 
        users: userData || { username: 'Utilisateur', display_name: 'Utilisateur TikTok' } 
      }, 
      error: null 
    }

  } catch (err: any) {
    console.error("🔥 [CRITICAL SERVER ERROR]:", err)
    return { data: null, error: err }
  }
})

// 🌐 ÉTAPE 1 : SEO & Open Graph (Utilise le cache)
export async function generateMetadata({ params }: VideoPageProps, _parent: ResolvingMetadata): Promise<Metadata> {
  const { id } = params
  const { data } = await getCachedVideo(id)

  if (!data) return { title: 'Vidéo introuvable | TikTok Clone' }

  const user = Array.isArray(data.users) ? data.users[0] : (data.users as any)
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
  console.log("🔍 [DEBUG SERVER] Username:", decodedUsername)
  console.log("🔍 [DEBUG SERVER] Video ID/Slug:", id)

  if (!decodedUsername.startsWith('@')) {
    console.error("❌ Erreur : Le pseudo ne commence pas par @")
    return notFound()
  }

  const { data: videoData, error } = await getCachedVideo(id)

  // 🛡️ CRITIQUE : Affichage d'une vue de Debug au lieu d'une 404 brutale
  if (error || !videoData) {
    console.error("❌ Vidéo non trouvée dans Supabase. Erreur :", error?.message || "Aucune donnée")
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white p-6 z-[200]">
        <div className="bg-zinc-900 border border-white/10 p-8 rounded-2xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-300">
          <h2 className="text-2xl font-bold mb-4 text-tiktok-pink">Oups ! Vidéo Introuvable</h2>
          <div className="space-y-3 text-sm text-zinc-400">
            <p>Le serveur a reçu ces informations :</p>
            <ul className="list-disc list-inside bg-black/40 p-4 rounded-lg font-mono text-[11px] break-all">
              <li>Pseudo : <span className="text-white">{decodedUsername}</span></li>
              <li>ID/Slug : <span className="text-white">{id}</span></li>
              <li>Erreur DB : <span className="text-tiktok-pink">{error?.message || "Non trouvé"}</span></li>
            </ul>
            <p className="mt-4 pt-4 border-t border-white/5 italic">
              Vérifiez bien la casse (Majuscules/Minuscules) du slug si vous l'avez tapé à la main.
            </p>
          </div>
          <Link 
            href="/"
            className="w-full mt-8 bg-white text-black font-bold py-3 rounded-full hover:bg-zinc-200 transition-all active:scale-95 flex items-center justify-center"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    )
  }

  // Normalisation
  const video = {
    ...videoData,
    users: Array.isArray(videoData.users) ? videoData.users[0] : videoData.users
  }

  // Vérification canonique
  const realUsername = `@${video.users?.username}`
  console.log("🔍 [DEBUG SERVER] Real Username from DB:", realUsername)

  if (decodedUsername.toLowerCase() !== realUsername.toLowerCase()) {
    console.log("🔄 Redirection vers l'URL canonique :", realUsername)
    return redirect(`/${realUsername}/video/${video.slug || video.id}`)
  }

  return (
    <div key={videoData.id} className="fixed inset-0 bg-black">
       <StandaloneVideoPage initialVideo={video as any} />
    </div>
  )
}
