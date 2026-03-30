'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'

export default function NotifProvider({ children }: { children: React.ReactNode }) {
  const currentUser = useStore((s: any) => s.currentUser)

  useEffect(() => {
    if (!currentUser) return;

    let isMounted = true;
    let channel: any = null;

    // Realtime Notifications Listener (Global)
    const initRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || !isMounted) return;

      channel = supabase
        .channel('global-notifs')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`
        }, async (payload: any) => {
          const { unreadNotificationsCount, setUnreadNotificationsCount } = useStore.getState() as any
          setUnreadNotificationsCount(unreadNotificationsCount + 1)

          let actorName = ''
          if (payload.new.actor_id) {
            const { data: actor } = await supabase.from('users').select('username').eq('id', payload.new.actor_id).single()
            if (actor) {
              actorName = `@${actor.username} `
            }
          }

          const typeLabel = payload.new.type === 'like' ? 'a aimé votre vidéo' : 
                          payload.new.type === 'comment' ? 'a commenté votre vidéo' :
                          payload.new.type === 'follow' ? 'a commencé à vous suivre' :
                          'Nouvelle interaction reçue';
          
          toast.success(`${actorName}${typeLabel}`, {
            icon: '🔔',
            duration: 4000,
            style: { background: '#fe2c55', color: '#fff' }
          });
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${session.user.id}`
        }, () => {
          const { unreadMessagesCount, setUnreadMessagesCount } = useStore.getState() as any
          setUnreadMessagesCount(unreadMessagesCount + 1)
          
          toast.success('Nouveau message reçu', {
            icon: '💬',
            duration: 3000,
            style: { background: '#fe2c55', color: '#fff' }
          });
        })
        .subscribe();
    };

    initRealtime();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  return <>{children}</>;
}
