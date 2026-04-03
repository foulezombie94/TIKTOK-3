'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Link, MessageCircle, Send, Phone, UserPlus, Share2, MoreHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'

interface ShareSheetProps {
  isOpen: boolean
  onClose: () => void
  video: {
    id: string
    slug?: string
    users?: {
      username: string
    }
    caption?: string
  }
  mode?: 'video' | 'profile'
}

export default function ShareSheet({ isOpen, onClose, video, mode = 'video' }: ShareSheetProps) {
  // 🛡️ Normalisation robuste de l'utilisateur (Gestion array vs object de la DB)
  const userData = Array.isArray(video.users) ? video.users[0] : video.users
  const username = userData?.username || 'Utilisateur'

  const shareUrl = typeof window !== 'undefined' 
    ? (mode === 'video' 
        ? `${window.location.origin}/@${username}/video/${video.slug || video.id}`
        : `${window.location.origin}/@${username}`)
    : ''

  // -- 🛡️ UX: Scroll Block & Escape Key
  useEffect(() => {
    if (isOpen) {
      // 1. Sauvegarde le style d'origine
      const originalOverflow = window.getComputedStyle(document.body).overflow
      document.body.style.overflow = 'hidden'
      
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      window.addEventListener('keydown', handleEsc)
      
      return () => {
        // 2. Restaure le style d'origine au lieu de forcer 'auto'
        document.body.style.overflow = originalOverflow
        window.removeEventListener('keydown', handleEsc)
      }
    }
  }, [isOpen, onClose])

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Lien copié !', {
        duration: 2000,
        style: {
          background: '#333',
          color: '#fff',
          borderRadius: '10px',
        },
      })
      onClose()
    } catch {
      toast.error('Erreur lors de la copie')
    }
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: mode === 'video' ? `Vidéo de @${username}` : `Profil de @${username}`,
          text: mode === 'video' 
            ? (video.caption || 'Regarde cette vidéo sur TikTok Clone')
            : `Découvre le profil de @${username} sur TikTok Clone !`,
          url: shareUrl,
        })
        onClose()
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          toast.error('Erreur de partage')
        }
      }
    } else {
      handleCopyLink()
    }
  }

  const shareOptions = [
    { name: 'Plus...', icon: <MoreHorizontal className="w-6 h-6" />, color: 'bg-zinc-700', action: handleNativeShare },
    { name: 'WhatsApp', icon: <Phone className="w-6 h-6" />, color: 'bg-[#25D366]', action: () => window.open(`https://wa.me/?text=${encodeURIComponent(shareUrl)}`) },
    { name: 'Facebook', icon: <Share2 className="w-6 h-6" />, color: 'bg-[#1877F2]', action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`) },
    { name: 'Twitter', icon: <Send className="w-6 h-6" />, color: 'bg-[#1DA1F2]', action: () => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`) },
    { name: 'Messenger', icon: <MessageCircle className="w-6 h-6" />, color: 'bg-[#0084FF]', action: () => window.open(`https://www.messenger.com/t/`) },
    { name: 'SMS', icon: <Send className="w-6 h-6" />, color: 'bg-[#34C759]', action: () => window.open(`sms:?body=${encodeURIComponent(shareUrl)}`) },
  ]

  const actionOptions = [
    { name: 'Copier le lien', icon: <Link className="w-6 h-6" />, color: 'bg-zinc-800', action: handleCopyLink },
    { name: 'Duo', icon: <UserPlus className="w-6 h-6" />, color: 'bg-zinc-800', action: () => toast('Bientôt disponible !') },
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
          />

          {/* 💎 Sheet (with Drag Logic) */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.6}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose()
              }
            }}
            className="relative w-full max-w-md bg-zinc-900 rounded-t-[32px] p-6 pb-10 flex flex-col gap-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] cursor-default select-none"
          >
            {/* 💎 Handle Bar */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-white/20 rounded-full" />

            {/* Header */}
            <div className="flex items-center justify-between pt-2">
              <h3 className="text-sm font-bold text-white/90 w-full text-center tracking-tight">
                {mode === 'video' ? 'Partager à' : 'Partager le profil'}
              </h3>
              <button 
                onClick={onClose}
                className="absolute right-6 p-1.5 bg-zinc-800 rounded-full text-white/60 active:scale-90"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Social Share Row */}
            <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide">
              {shareOptions.map((option) => (
                <button
                  key={option.name}
                  onClick={option.action}
                  className="flex flex-col items-center gap-2 min-w-[72px] active:scale-90 transition-transform"
                >
                  <div className={`w-14 h-14 ${option.color} rounded-full flex items-center justify-center text-white shadow-xl`}>
                    {option.icon}
                  </div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{option.name}</span>
                </button>
              ))}
            </div>

            <div className="h-[1px] bg-white/5 w-full" />

            {/* Utilities Row */}
            <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide">
              {actionOptions.map((option) => (
                <button
                  key={option.name}
                  onClick={option.action}
                  className="flex flex-col items-center gap-2 min-w-[72px] active:scale-90 transition-transform"
                >
                  <div className={`w-14 h-14 ${option.color} rounded-full flex items-center justify-center text-white border border-white/5`}>
                    {option.icon}
                  </div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{option.name}</span>
                </button>
              ))}
            </div>

            {/* Cancel Button */}
            <button 
              onClick={onClose}
              className="w-full py-4 text-sm bg-zinc-800/80 hover:bg-zinc-800 text-white font-bold rounded-2xl transition-all active:scale-[0.98]"
            >
              Annuler
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
