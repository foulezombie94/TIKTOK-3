'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { syncNetworkIdentifiers } from '@/lib/device'
import { useStore } from '@/store/useStore'
import LoginScreen from './LoginScreen'
import { motion, AnimatePresence } from 'framer-motion'
import { Music2 } from 'lucide-react'

/**
 * 🛡️ AUTHGUARD ELITE (v4)
 * - Protège les routes sensibles.
 * - Autorise l'accès anonyme aux routes publiques (Feed, Vidéos, Profils).
 * - UX Fluide : L'utilisateur n'est pas bloqué sur un écran de login s'il consulte un lien partagé.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const currentUser = useStore((s) => s.currentUser)
  const isAuthLoading = useStore((s) => s.isAuthLoading)
  const setIsAuthLoading = useStore((s) => s.setIsAuthLoading)

  // 📝 WHITELIST DES ROUTES PUBLIQUES
  const isPublicRoute = (path: string) => {
    // Accueil (FYP)
    if (path === '/') return true
    // Vidéos Partagées (/@username/video/id)
    if (path.includes('/video/')) return true
    // Profils (/@username)
    if (path.startsWith('/@')) return true
    // Legacy Redirects (/v/slug)
    if (path.startsWith('/v/')) return true
    
    return false
  }

  // 🛡️ SECURITY SYNC (Proactive Capture pour les bannis)
  useEffect(() => {
    if (currentUser?.id) {
      syncNetworkIdentifiers(supabase, currentUser.id)
    }
  }, [currentUser])

  // Safety timeout pour éviter l'écran blanc éternel
  useEffect(() => {
    if (!isAuthLoading) return
    const timeout = setTimeout(() => setIsAuthLoading(false), 5000)
    return () => clearTimeout(timeout)
  }, [isAuthLoading, setIsAuthLoading])

  const showApp = currentUser || isPublicRoute(pathname)

  return (
    <AnimatePresence mode="wait">
      {isAuthLoading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center"
        >
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Music2 className="w-20 h-20 text-white drop-shadow-[2px_2px_0_#FE2C55] drop-shadow-[-2px_-2px_0_#25F4EE]" />
          </motion.div>
          <div className="mt-8 flex flex-col items-center gap-2">
            <span className="text-white font-bold tracking-[0.2em] text-sm uppercase">TikTok</span>
            <div className="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ x: '-100%' }}
                 animate={{ x: '100%' }}
                 transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                 className="w-full h-full bg-tiktok-pink"
               />
            </div>
          </div>
        </motion.div>
      ) : !showApp ? (
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="w-full h-full"
        >
          <LoginScreen />
        </motion.div>
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full h-full overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
