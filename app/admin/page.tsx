import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AdminPanel() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/')

  // FETCH DES REPORTS DEPUIS LA TABLE SECURISEE
  // Graçe à la RLS "Admins seulement", cela échouera si le middleware est paré.
  const { data: reports, error } = await supabase
    .from('reports')
    .select('*, reporter:users(username), video:videos(title)')
    .order('created_at', { ascending: false })

  if (error) {
    return <div className="p-8 text-white min-h-screen bg-black">Erreur de chargement des signalements ou droit refusé.</div>
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 overflow-y-auto w-full max-w-5xl mx-auto">
      <h1 className="text-3xl font-black mb-2 flex items-center gap-2">
        🛡️ Espace Modération
      </h1>
      <p className="text-zinc-500 mb-8 border-b border-zinc-800 pb-4">Gérez les signalements (Reports) et utilisateurs toxiques.</p>

      {reports?.length === 0 ? (
        <div className="text-zinc-400 text-center py-12 bg-zinc-900 rounded-xl">
            Tout est propre ! Aucun signalement en attente.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
            {reports?.map((report) => (
                <div key={report.id} className="bg-zinc-900 border border-red-900/30 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-red-900/60 transition-colors">
                    <div className="flex flex-col">
                        <span className="text-red-500 font-bold text-sm mb-1 uppercase tracking-wide">Signalement : {report.reason}</span>
                        <span className="text-zinc-300">Vidéo ID : {report.video_id}</span>
                        <span className="text-zinc-500 text-xs mt-1">
                          Signalé par : @{report.reporter?.username || 'Utilisateur inconnu'} - {new Date(report.created_at).toLocaleDateString()}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto mt-4 md:mt-0">
                        {/* NOTE: Ces boutons requièrent de créer un Server Action ou une route API pour éxecuter le ban. */}
                        <button className="flex-1 md:flex-none bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm">
                            Bannir l'auteur
                        </button>
                        <button className="flex-1 md:flex-none bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded-md border border-zinc-700 transition-colors text-sm">
                            Ignorer
                        </button>
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  )
}
