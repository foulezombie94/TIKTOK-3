'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/store/useStore'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const currentUser = useStore((s: any) => s.currentUser)
  const setCurrentUser = useStore((s: any) => s.setCurrentUser)
  const setIsAuthLoading = useStore((s: any) => s.setIsAuthLoading)
  const intendedPath = useStore((s: any) => s.intendedPath)
  const setIntendedPath = useStore((s: any) => s.setIntendedPath)

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (userData) {
        setCurrentUser(userData)
      } else {
        setTimeout(async () => {
           const { data: retryData } = await supabase.from('users').select('*').eq('id', userId).single()
           if (retryData) setCurrentUser(retryData)
        }, 1500)
      }

      // Initialisation des compteurs d'inbox (Bootup)
      const [notifRes, msgRes] = await Promise.all([
        supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false),
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('receiver_id', userId).eq('is_read', false)
      ])

      const { setUnreadNotificationsCount, setUnreadMessagesCount } = useStore.getState() as any
      setUnreadNotificationsCount(notifRes.count || 0)
      setUnreadMessagesCount(msgRes.count || 0)

    } catch (err) {
      console.error("Auth Error:", err)
    } finally {
      setIsAuthLoading(false)
    }
  }, [setCurrentUser, setIsAuthLoading])

  useEffect(() => {
    // Phase 1 : Charger la session initiale
    const initAuth = async () => {
      setIsAuthLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await fetchProfile(session.user.id)
      } else {
        setIsAuthLoading(false)
      }
    }
    
    initAuth()

    // Phase 2 : Écouter les changements d'état (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        fetchProfile(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null)
        setIsAuthLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchProfile, setCurrentUser, setIsAuthLoading])

  // 🎯 EFFECT : REDIRECTION POST-LOGIN (Redirect-Back)
  useEffect(() => {
    if (currentUser && intendedPath) {
      console.log("🚀 [AUTH PROVIDER] Redirection vers le chemin d'intention :", intendedPath)
      const path = intendedPath
      setIntendedPath(null) // Nettoyage immédiat pour éviter les boucles
      router.push(path)
    }
  }, [currentUser, intendedPath, router, setIntendedPath])

  return <>{children}</>
}
