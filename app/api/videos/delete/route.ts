import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin' // Requiert la clé service_role

// Route /api/videos/delete pour régler le problème des "Fichiers Orphelins"
export async function DELETE(req: Request) {
  try {
    const supabaseUser = createClient()
    const { data: { session } } = await supabaseUser.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { videoId } = await req.json()

    // 1. Vérification sécurisée : Propriétaire ou Admin
    const { data: videoData, error: fetchError } = await supabaseUser
      .from('videos')
      .select('id, user_id, video_url')
      .eq('id', videoId)
      .single()

    const isAdmin = session.user.app_metadata?.role === 'admin' 
      || session.user.user_metadata?.role === 'admin'

    if (fetchError || !videoData || (videoData.user_id !== session.user.id && !isAdmin)) {
      return NextResponse.json({ error: 'Vidéo introuvable ou droits insuffisants' }, { status: 403 })
    }

    // Extraction du filePath à partir de l'URL Supabase de manière robuste
    // URL format: https://.../storage/v1/object/public/videos/username/filename.mp4
    let filePath: string
    try {
      const url = new URL(videoData.video_url)
      // On récupère le chemin relatif après /public/videos/
      const pathSegments = url.pathname.split('/videos/')
      if (pathSegments.length < 2) throw new Error("Format d'URL invalide")
      filePath = pathSegments[pathSegments.length - 1]
    } catch (e) {
      throw new Error(`Erreur lors du parsing de l'URL: ${videoData.video_url}`)
    }

    // 2. SUPPRESSION DU BUCKET STORAGE (Utilisation obligée de supabaseAdmin pour bypass RLS)
    const { error: storageError } = await supabaseAdmin.storage
      .from('videos')
      .remove([filePath])

    if (storageError) {
      console.error("Erreur de nettoyage Storage (Fichier peut-être déjà absent):", storageError)
    }

    // 3. Suppression dans la base PostgreSQL (Cela 'cascade' sur les commentaires/likes/bookmarks)
    const { error: dbError } = await supabaseUser
      .from('videos')
      .delete()
      .eq('id', videoId)

    if (dbError) throw dbError

    return NextResponse.json({ success: true, message: "Fichier et vidéo supprimés intégralement" })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
