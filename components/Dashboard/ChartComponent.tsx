'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function ChartComponent({ rawData }: { rawData: any[] }) {
  // === OPTIMISATION ABSOLUE : useMemo ===
  // Si le parent (page) ou l'état global charge, on ne bloque pas le thread UI principal
  // car Recharts re-dessine tous les noeuds SVG. On gèle la donnée ici.
  const chartData = useMemo(() => {
    if (!rawData || rawData.length === 0) return []
    
    // Assurer le formatage de date
    return rawData.map(d => ({
      name: new Date(d.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
      Vues: d.daily_views
    }))
  }, [rawData])

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
          <XAxis dataKey="name" stroke="#888" tick={{ fill: '#888' }} axisLine={false} tickLine={false} />
          <YAxis stroke="#888" tick={{ fill: '#888' }} axisLine={false} tickLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
            itemStyle={{ color: '#fe2c55', fontWeight: 'bold' }}
          />
          <Line 
            type="monotone" 
            dataKey="Vues" 
            stroke="#fe2c55" 
            strokeWidth={3}
            dot={{ r: 4, fill: '#fe2c55', strokeWidth: 0 }}
            activeDot={{ r: 6, stroke: '#fe2c55', strokeWidth: 2, fill: '#111' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
