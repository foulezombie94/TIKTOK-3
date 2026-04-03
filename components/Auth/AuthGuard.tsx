'use client'

import { useEffect, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { syncNetworkIdentifiers } from '@/lib/device'
import { useStore } from '@/store/useStore'
import LoginScreen from './LoginScreen'
import { motion, AnimatePresence } from 'framer-motion'
import { Music2 } from 'lucide-react'

/**
 * 🛡️ AUTHGUARD ELITE (v5 - Staff Grade)
 * - Whitelist Robuste via Regex (Sécurité accrue).
 * - Mémorisation de l'Intention (Redirect-Back UX).
 * - Optimisation de Rendu (useMemo).
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
  const currentUser = useStore((s) => s.currentUser)
  const isAuthLoading = useStore((s) => s.isAuthLoading)
  const setIsAuthLoading = useStore((s) => s.setIsAuthLoading)
  const setIntendedPath = useStore((s: any) => s.setIntendedPath)

  // 📝 WHITELIST DES ROUTES PUBLIQUES (HYBRIDE)
  // On n'autorise QUE la connexion et les liens vidéos partagés.
  const isPublicRoute = useMemo(() => {
    const publicPatterns = [
      /^\/login$/,                  // Connexion
      /^\/@[a-zA-Z0-9._]+\/video\//, // Vidéos partagées
      /^\/v\//,                     // Legacy redirects
    ]
    return publicPatterns.some(pattern => pattern.test(pathname))
  }, [pathname])

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

  // 🎯 CAPTURE D'INTENTION : Mémorise la page privée si l'utilisateur est bloqué
  useEffect(() => {
    if (!isAuthLoading && !currentUser && !isPublicRoute) {
      console.log("🎯 [AUTHGUARD] Mémorisation du chemin d'intention :", pathname)
      setIntendedPath(pathname)
    }
  }, [pathname, currentUser, isPublicRoute, isAuthLoading, setIntendedPath])

  const showApp = useMemo(() => currentUser || isPublicRoute, [currentUser, isPublicRoute])

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
