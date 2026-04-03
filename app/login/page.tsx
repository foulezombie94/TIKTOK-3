'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/store/useStore'
import LoginScreen from '@/components/Auth/LoginScreen'

/**
 * 🔒 Page de Connexion Dédiée
 * Réutilise le composant LoginScreen pour une expérience uniforme.
 * Redirige vers l'accueil si l'utilisateur est déjà connecté.
 */
export default function LoginPage() {
  const router = useRouter()
  const currentUser = useStore((s) => s.currentUser)

  useEffect(() => {
    if (currentUser) {
      router.push('/')
    }
  }, [currentUser, router])

  return <LoginScreen />
}
