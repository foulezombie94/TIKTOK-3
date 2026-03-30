'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/store/useStore'
import { MessageSquare, Bell, UserPlus, Heart, MessageCircle, ChevronRight, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function InboxPage() {
  const currentUser = useStore((s: any) => s.currentUser)
  const isAuthLoading = useStore((s: any) => s.isAuthLoading)
  const [activeTab, setActiveTab] = useState<'messages' | 'notifications'>('messages')
  const [conversations, setConversations] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Utilisation du store pour la synchronisation globale
  const unreadNotificationsCount = useStore((s: any) => s.unreadNotificationsCount)
  const setUnreadNotificationsCount = useStore((s: any) => s.setUnreadNotificationsCount)
  const unreadMessagesCount = useStore((s: any) => s.unreadMessagesCount)

  const fetchData = useCallback(async () => {
    if (!currentUser) return
    setLoading(true)
    
    // Conversations
    const { data: convData } = await supabase
      .from('conversations')
      .select(`id, participant_1, participant_2, updated_at`)
      .or(`participant_1.eq.${currentUser.id},participant_2.eq.${currentUser.id}`)
      .order('updated_at', { ascending: false })

    if (convData) {
      const enriched = await Promise.all(convData.map(async (c) => {
        const recipientId = c.participant_1 === currentUser.id ? c.participant_2 : c.participant_1
        const { data: user } = await supabase.from('users').select('*').eq('id', recipientId).single()
        const { data: lastMsg } = await supabase.from('messages').select('*').eq('conversation_id', c.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        return { ...c, recipient: user, lastMsg }
      }))
      setConversations(enriched)
    }

    // Notifications
    const { data: notifData } = await supabase
      .from('notifications')
      .select(`*, actor:users!notifications_actor_id_fkey(*)`)
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
    
    if (notifData) {
      setNotifications(notifData)
      const count = notifData.filter(n => !n.read).length
      setUnreadNotificationsCount(count)
      
      if (count > 0 && activeTab === 'messages') {
         setActiveTab('notifications')
      }
    }

    // Messages (Sync global)
    const { count: mCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', currentUser.id)
      .eq('read', false)
    
    if (mCount !== null) {
      const { setUnreadMessagesCount } = useStore.getState() as any
      setUnreadMessagesCount(mCount)
    }

    setLoading(false)
  }, [currentUser, setUnreadNotificationsCount])

  useEffect(() => {
    if (isAuthLoading || !currentUser) return
    fetchData()

    // Realtime Sync pour la liste
    const channel = supabase
      .channel('inbox-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`
      }, (payload) => {
        supabase.from('users').select('*').eq('id', payload.new.actor_id).single().then(({ data: actor }) => {
          const newNotif = { ...payload.new, actor }
          setNotifications(prev => [newNotif, ...prev])
          setUnreadNotificationsCount(useStore.getState().unreadNotificationsCount + 1)
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser, isAuthLoading, fetchData, setUnreadNotificationsCount])

  // Mark all notifications as read when entering the notification tab
  useEffect(() => {
    if (activeTab === 'notifications' && currentUser) {
      const hasUnread = notifications.some(n => !n.read)
      if (hasUnread) {
        const markAsRead = async () => {
          await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', currentUser.id)
            .eq('read', false)
          
          setNotifications(prev => prev.map(n => ({ ...n, read: true })))
          setUnreadNotificationsCount(0) // Mise à jour du store global
        }
        markAsRead()
      }
    }
  }, [activeTab, currentUser, notifications, setUnreadNotificationsCount])

  if (isAuthLoading || !currentUser) {
    return <div className="h-full flex items-center justify-center bg-black"><Loader2 className="animate-spin text-tiktok-pink" /></div>
  }

  return (
    <div className="bg-black min-h-screen text-white pb-20">
      <div className="flex flex-col border-b border-zinc-900 sticky top-0 bg-black/80 backdrop-blur z-10 px-4 pt-4">
        <h1 className="text-xl font-bold mb-4">Boîte de réception</h1>
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveTab('messages')}
            className={`relative pb-2 px-2 text-sm font-semibold transition-all border-b-2 ${activeTab === 'messages' ? 'border-white text-white' : 'border-transparent text-zinc-500'}`}
          >
            Messages
            {unreadMessagesCount > 0 && (
               <span className="ml-1 bg-tiktok-pink text-[10px] px-1.5 py-0.5 rounded-full">{unreadMessagesCount}</span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            className={`relative pb-2 px-2 text-sm font-semibold transition-all border-b-2 ${activeTab === 'notifications' ? 'border-white text-white' : 'border-transparent text-zinc-500'}`}
          >
            Notifications
            {unreadNotificationsCount > 0 && (
               <span className="ml-1 bg-tiktok-pink text-[10px] px-1.5 py-0.5 rounded-full">{unreadNotificationsCount}</span>
            )}
          </button>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="animate-spin text-tiktok-pink" />
          </div>
        ) : (
          <>
            {/* ONGLET MESSAGES */}
            {activeTab === 'messages' && (
              <div className="space-y-4">
                {conversations.length === 0 ? (
                   <div className="flex flex-col items-center py-20 text-zinc-500">
                     <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                     <p>Aucun message pour l&apos;instant</p>
                   </div>
                ) : conversations.map(c => (
                  <Link key={c.id} href={`/chat/${c.id}`} className="flex items-center gap-3 active:bg-zinc-900 p-2 rounded-xl transition-all">
                    <img src={c.recipient?.avatar_url} className="w-14 h-14 rounded-full object-cover bg-zinc-800" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate">{c.recipient?.display_name}</h3>
                      <p className="text-xs text-zinc-500 truncate">{c.lastMsg?.content || 'Démarrez la conversation'}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-700" />
                  </Link>
                ))}
              </div>
            )}

            {/* ONGLET NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                {notifications.length === 0 ? (
                   <div className="flex flex-col items-center py-20 text-zinc-500">
                     <Bell className="w-12 h-12 mb-4 opacity-20" />
                     <p>Aucune notification pour l&apos;instant</p>
                   </div>
                ) : notifications.map(n => (
                  <div key={n.id} className={`flex items-center gap-3 p-2 rounded-xl transition-all ${!n.read ? 'bg-zinc-900/50 border-l-2 border-tiktok-pink' : ''}`}>
                    <img 
                      src={n.actor?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} 
                      className="w-10 h-10 rounded-full object-cover bg-zinc-800 border border-zinc-800" 
                    />
                    <div className="flex-1 text-sm">
                      <span className="font-bold">@{n.actor?.username || 'Utilisateur'}</span>
                      <span className="ml-1 text-zinc-300">
                        {n.type === 'like' && 'a aimé votre vidéo'}
                        {n.type === 'comment' && 'a commenté votre vidéo'}
                        {n.type === 'follow' && 'a commencé à vous suivre'}
                        {n.type === 'message' && 'vous a envoyé un message'}
                      </span>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        {n.created_at ? new Date(n.created_at).toLocaleDateString() : 'Aujourd\'hui'}
                      </p>
                    </div>
                    <div className="w-10 h-14 bg-zinc-900 rounded-md overflow-hidden flex items-center justify-center">
                       {n.video_id ? (
                         <div className="w-full h-full bg-tiktok-pink/20" />
                       ) : (
                         <UserPlus className="w-5 h-5 text-zinc-500" />
                       )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
