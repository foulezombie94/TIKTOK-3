'use client'

import { Home, Search, Plus, MessageSquare, User } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useStore } from '@/store/useStore'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function BottomNav() {
  const pathname = usePathname()
  const currentUser = useStore((s: any) => s.currentUser)
  const setShowAuthModal = useStore((s: any) => s.setShowAuthModal)
  
  // Utilisation des compteurs globaux (Source de Vérité Unique)
  const unreadMessagesCount = useStore((s: any) => s.unreadMessagesCount)
  const unreadNotificationsCount = useStore((s: any) => s.unreadNotificationsCount)
  const totalUnread = unreadMessagesCount + unreadNotificationsCount

  const handleProfileClick = (e: React.MouseEvent) => {
    if (!currentUser) {
      e.preventDefault()
      setShowAuthModal(true)
    }
  }

  const handleInboxClick = (e: React.MouseEvent) => {
    if (!currentUser) {
      e.preventDefault()
      setShowAuthModal(true)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex h-[60px] w-full max-w-[500px] mx-auto items-center justify-around border-t border-zinc-900 bg-black px-4 pb-safe">
      <Link href="/" className="flex flex-col items-center gap-1">
        <Home className={`w-6 h-6 ${pathname === '/' ? 'text-white' : 'text-zinc-500'}`} />
        <span className={`text-[10px] font-medium ${pathname === '/' ? 'text-white' : 'text-zinc-500'}`}>Accueil</span>
      </Link>

      <Link href="/discover" className="flex flex-col items-center gap-1">
        <Search className={`w-6 h-6 ${pathname === '/discover' ? 'text-white' : 'text-zinc-500'}`} />
        <span className={`text-[10px] font-medium ${pathname === '/discover' ? 'text-white' : 'text-zinc-500'}`}>Découvrir</span>
      </Link>

      <Link href="/upload" className="flex flex-col items-center gap-1 group">
         <div className="relative">
            <div className="absolute inset-0 bg-tiktok-cyan -translate-x-1 rounded-md" />
            <div className="absolute inset-0 bg-tiktok-pink translate-x-1 rounded-md" />
            <div className="relative bg-white rounded-md px-3 py-1 flex items-center justify-center">
               <Plus className="w-5 h-5 text-black font-bold" />
            </div>
         </div>
         <span className="text-[10px] font-medium text-transparent">Post</span>
      </Link>

      <Link href="/inbox" onClick={handleInboxClick} className="flex flex-col items-center gap-1 relative">
        <div className="relative">
          <MessageSquare className={`w-6 h-6 ${pathname === '/inbox' ? 'text-white' : 'text-zinc-500'}`} />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1.5 bg-tiktok-pink text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-black animate-pulse">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </div>
        <span className={`text-[10px] font-medium ${pathname === '/inbox' ? 'text-white' : 'text-zinc-500'}`}>Inbox</span>
      </Link>

      <Link 
        href={currentUser ? `/profile/${currentUser.username}` : '#'} 
        onClick={handleProfileClick}
        className="flex flex-col items-center gap-1"
      >
        <User className={`w-6 h-6 ${pathname.startsWith('/profile') ? 'text-white' : 'text-zinc-500'}`} />
        <span className={`text-[10px] font-medium ${pathname.startsWith('/profile') ? 'text-white' : 'text-zinc-500'}`}>Profil</span>
      </Link>
    </div>
  )
}
