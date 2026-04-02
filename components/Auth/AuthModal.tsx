'use client'

import { useState, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { supabase } from '@/lib/supabase'
import { X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AuthModal() {
  const showAuthModal = useStore((s) => s.showAuthModal)
  const setShowAuthModal = useStore((s) => s.setShowAuthModal)
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)

  // Block body scroll when open
  useEffect(() => {
    if (showAuthModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }, [showAuthModal])

  if (!showAuthModal) return null

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        toast.success('Connexion réussie')
        setShowAuthModal(false)
      } else {
        if (!username) {
           toast.error('Le nom d\'utilisateur est requis')
           setLoading(false)
           return
        }

        // Vérification proactive du pseudo (WPO & UX)
        const { data: isAvailable, error: checkError } = await supabase.rpc('check_username_availability', {
          p_username: username
        })

        if (!isAvailable && !checkError) {
          toast.error('Ce nom d\'utilisateur est déjà pris')
          setLoading(false)
          return
        }
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
              full_name: username,
              avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
            },
          },
        })
        if (error) throw error
        
        toast.success('Compte créé ! Redirection en cours...')
        
        // Laisser un peu de temps au trigger SQL de finir
        setTimeout(() => {
          setShowAuthModal(false)
          setLoading(false)
        }, 1500)
      }
    } catch (err: any) {
      // Handle specific Supabase/PostgreSQL errors (like unique constraint violation)
      const message = err?.message || "Une erreur est survenue"
      
      if (message.includes('unique_username') || message.includes('already exists')) {
        toast.error('Ce nom d\'utilisateur est déjà pris')
      } else if (message.includes('rate limit')) {
        toast.error('Trop de tentatives. Veuillez patienter.')
      } else {
        toast.error(message)
      }
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-[#1a1a1a] p-6 shadow-2xl border border-white/10 animate-fade-in">
        <button
          onClick={() => setShowAuthModal(false)}
          className="absolute right-4 top-4 p-2 rounded-full bg-white/5 text-white/60 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold text-center mb-8">
          {isLogin ? 'Connexion' : 'Inscription'} à TikTok
        </h2>

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          {!isLogin && (
            <input
              type="text"
              placeholder="Nom d'utilisateur"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg bg-[#2a2a2a] px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-tiktok-pink"
              required
            />
          )}
          <input
            type="email"
            placeholder="Adresse e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-[#2a2a2a] px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-tiktok-pink"
            required
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-[#2a2a2a] px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-tiktok-pink"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full flex items-center justify-center rounded-lg bg-tiktok-pink py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Se connecter' : 'Créer un compte')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          {isLogin ? "Vous n'avez pas de compte ?" : "Vous avez déjà un compte ?"}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="ml-2 font-semibold text-tiktok-pink hover:underline"
          >
            {isLogin ? "S'inscrire" : 'Se connecter'}
          </button>
        </div>
      </div>
    </div>
  )
}
