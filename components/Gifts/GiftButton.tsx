'use client'
import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Gift } from 'lucide-react'

export default function GiftButton({ videoId, creatorId, price }: { videoId: string, creatorId: string, price: number }) {
  const [isSending, setIsSending] = useState(false)

  const handleSendGift = useCallback(async () => {
    // 1. Verrou côté Frontend pour éviter le spam (Double-clic multi-thread)
    if (isSending) return

    // Impossible de s'auto-envoyer un cadeau
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      toast.error("Connectez-vous pour envoyer un cadeau")
      return
    }
    if (session.user.id === creatorId) {
      toast.error("Vous ne pouvez pas vous envoyer un cadeau à vous-même")
      return
    }

    setIsSending(true)
    const toastId = toast.loading("Envoi du cadeau... 🎁")

    try {
      // 2. Appel de la fonction atomique sécurisée (PL/pgSQL avec FOR UPDATE)
      const { error } = await supabase.rpc('send_gift', {
        p_receiver_id: creatorId,
        p_amount: price,
        p_video_id: videoId
      })

      if (error) {
        // Interprétation propre de l'erreur SQL "Solde insuffisant"
        if (error.message.includes('Solde insuffisant')) {
          throw new Error("Solde insuffisant. Achetez plus de Coins ! 🪙")
        }
        throw new Error(error.message)
      }

      toast.success(`Cadeau de ${price} Coins envoyé au créateur ! 🎉`, { id: toastId, duration: 4000 })
    } catch (err: any) {
      toast.error(err.message || "Échec de la transaction", { id: toastId })
    } finally {
      setIsSending(false)
    }
  }, [isSending, creatorId, price, videoId])

  return (
    <div className="flex flex-col items-center mt-4">
      <button
        disabled={isSending}
        onClick={handleSendGift}
        className={`w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center transition-all ${isSending ? 'opacity-50' : 'active:scale-90 hover:bg-zinc-700'}`}
      >
        <Gift className={`w-6 h-6 ${isSending ? 'text-zinc-500 animate-pulse' : 'text-tiktok-pink'}`} />
      </button>
      <span className="text-white text-xs mt-1 font-semibold">{price} Coins</span>
    </div>
  )
}
