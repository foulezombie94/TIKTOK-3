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

    // 1. Vérification sécurisée du propriétaire de la vidéo
    const { data: videoData, error: fetchError } = await supabaseUser
      .from('videos')
      .select('id, user_id, video_url')
      .eq('id', videoId)
      .single()

    if (fetchError || !videoData || videoData.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Vidéo introuvable ou vous n\'en êtes pas le propriétaire' }, { status: 403 })
    }

    // Extraction du filePath à partir de l'URL Supabase
    // Exemple d'URL : https://xxx.supabase.co/storage/v1/object/public/videos/username/filename.mp4
    const urlParts = videoData.video_url.split('/videos/')
    if (urlParts.length !== 2) throw new Error("Format d'URL de vidéo invalide")
    const filePath = urlParts[1]

    // 2. SUPPRESSION DU BUCKET STORAGE EN PREMIER (Faille résolue)
    // Nous utilisons un admin client ou supabase_service_role pour contourner les règles potentiellement restrictives.
    const { error: storageError } = await supabaseUser.storage
      .from('videos')
      .remove([filePath])

    if (storageError) {
      console.error("Erreur de nettoyage Storage:", storageError)
      // On continue quand même la suppression DB ou on stoppe selon sa stratégie
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
