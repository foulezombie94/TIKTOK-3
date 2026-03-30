import { createClient } from '@/utils/supabase/server'
import ChartComponent from '@/components/Dashboard/ChartComponent'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/')
  }

  // Fetch the heavy logic entirely on the server via our robust materialized view RPC
  const { data: stats, error } = await supabase.rpc('get_creator_dashboard', {
    p_creator_id: session.user.id
  })

  if (error) {
    return <div className="p-8 text-white min-h-screen bg-black">Erreur lors du chargement des statistiques.</div>
  }

  const rawData = stats?.chartData || []

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 ml-0 sm:ml-[70px] lg:ml-[250px] overflow-y-auto">
      <h1 className="text-2xl font-bold mb-6">Tableau de Bord Créateur</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl flex flex-col justify-center items-center">
          <h3 className="text-zinc-400 font-medium text-sm">Vues totales (30 jours)</h3>
          <p className="text-4xl font-black text-white mt-2">
            {stats?.total_views_30d?.toLocaleString() || 0}
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl flex flex-col justify-center items-center">
          <h3 className="text-zinc-400 font-medium text-sm">Revenus (TikTok Coins)</h3>
          <p className="text-4xl font-black text-tiktok-cyan mt-2">
            🪙 {stats?.total_coins?.toLocaleString() || 0}
          </p>
          <span className="text-xs text-zinc-500 mt-2">≈ {(stats?.total_coins || 0) * 0.01} € générés</span>
        </div>
      </div>

      <div className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
        <h3 className="text-white font-semibold mb-4 ml-4">Évolution des vues</h3>
        <ChartComponent rawData={rawData} />
      </div>
    </div>
  )
}
