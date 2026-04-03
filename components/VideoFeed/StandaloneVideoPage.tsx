'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { FeedVideo } from '@/types/video'
import VideoPlayer from './VideoPlayer'
import SidebarActions from './SidebarActions'
import VideoOverlay from './VideoOverlay'
import { useStore } from '@/store/useStore'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Loader2 } from 'lucide-react'

const CommentSheet = dynamic(() => import('@/components/Comments/CommentSheet'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black/50 z-50 animate-pulse" />
})

interface StandaloneVideoPageProps {
  initialVideo: FeedVideo
}

export default function StandaloneVideoPage({ initialVideo }: StandaloneVideoPageProps) {
  const router = useRouter()
  
  // 🛡️ Validation Hydratation suggérée par l'utilisateur
  useEffect(() => {
    console.log("🚀 [ELITE] Vidéo reçue du serveur :", initialVideo?.id)
  }, [initialVideo])

  const [videos, setVideos] = useState<FeedVideo[]>(() => [initialVideo])
  const [activeIndex, setActiveIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(initialVideo?.created_at || null)
  const [nextCursorId, setNextCursorId] = useState<string | null>(initialVideo?.id || null)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [commentVideoId, setCommentVideoId] = useState<string | null>(null)

  // 🔄 [FIX ELITE] : Synchro stricte + Reset Scroll (Navigation SPA)
  useEffect(() => {
    if (initialVideo?.id && initialVideo.id !== videos[0]?.id) {
      console.log("🎯 [ELITE] Focus sur la nouvelle vidéo :", initialVideo.id)
      setVideos([initialVideo])
      setActiveIndex(0)
      setNextCursor(initialVideo.created_at)
      setNextCursorId(initialVideo.id)
      setHasMore(true)
      
      // Remise à zéro du scroll
      const container = document.getElementById('video-scroll-container')
      if (container) container.scrollTop = 0
    }
  }, [initialVideo?.id])

  const currentUser = useStore((s: any) => s.currentUser)
  const VIDEOS_PER_PAGE = 6

  // 🔄 Chargement de la suite du feed (FYP) après la vidéo initiale
  const fetchMoreVideos = useCallback(async () => {
    if (isLoadingMore || !hasMore || !nextCursor) return
    setIsLoadingMore(true)

    try {
      const { data, error } = await supabase.rpc('get_fyp_videos_cursor', {
        p_user_id: currentUser?.id || '00000000-0000-0000-0000-000000000000',
        p_cursor: nextCursor,
        p_cursor_id: nextCursorId,
        p_limit: VIDEOS_PER_PAGE
      })

      if (error || !data || data.length === 0) {
        setHasMore(false)
        return
      }

      const filteredVids = data.filter((v: FeedVideo) => !videos.some(existing => existing.id === v.id))
      
      if (filteredVids.length > 0) {
        setVideos(prev => [...prev, ...filteredVids])
        const lastVideo = data[data.length - 1]
        setNextCursor(lastVideo.created_at)
        setNextCursorId(lastVideo.id)
      } else {
        setHasMore(false)
      }
    } finally {
      setIsLoadingMore(false)
    }
  }, [currentUser, nextCursor, nextCursorId, isLoadingMore, hasMore, videos])

  // Notification par VideoPlayer
  const handleInView = useCallback((index: number, inView: boolean) => {
    if (inView) {
      setActiveIndex(index)
      // Charger plus si on arrive vers la fin
      if (index >= videos.length - 2) {
        fetchMoreVideos()
      }
    }
  }, [videos.length, fetchMoreVideos])

  if (!initialVideo) return null

  return (
    <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center font-sans">
      
      {/* ⬅️ Back Button */}
      <button 
        onClick={() => router.push('/')}
        className="absolute top-6 left-6 z-[120] p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-xl transition-all active:scale-95 border border-white/10 text-white shadow-2xl"
      >
        <ArrowLeft className="w-6 h-6" />
      </button>

      {/* 📱 Main Video Container (iPhone Style) */}
      <div 
        id="video-scroll-container"
        className="relative w-full h-full md:max-w-[450px] md:h-[95vh] md:rounded-3xl md:border md:border-white/10 overflow-hidden bg-zinc-950 shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col"
      >
        <div className="relative flex-1 overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
          {videos.map((video, index) => (
            <div key={`${video.id}-${index}`} className="relative h-full w-full snap-start snap-always">
               <VideoPlayer 
                 video={video} 
                 index={index}
                 activeIndex={activeIndex}
                 onInView={handleInView}
               />
               
               {/* 🛡️ Feed Overlays (Identité normalisée et sécurisée) */}
               <VideoOverlay video={video} />
               
               <SidebarActions 
                  video={video as any}
                  currentUserId={currentUser?.id}
                  onCommentClick={() => setCommentVideoId(video.id)}
               />
            </div>
          ))}

          {isLoadingMore && (
            <div className="h-20 flex items-center justify-center bg-black">
              <Loader2 className="w-6 h-6 animate-spin text-tiktok-pink" />
            </div>
          )}
        </div>
      </div>

      {/* 📝 Comment Section (Overlay Everywhere - iPhone Style) */}
      <AnimatePresence>
        {(commentVideoId || (videos.length > 0 && activeIndex >= 0)) && (
          <div className="hidden">
             {/* Note: In iPhone mode, we use the CommentSheet in overlay mode via SidebarActions call or modal */}
          </div>
        )}

        {/* Unified Comment Overlay (Tours the split into an immersive modal) */}
        {commentVideoId && (
          <CommentSheet 
            videoId={commentVideoId}
            onClose={() => setCommentVideoId(null)}
          />
        )}
      </AnimatePresence>

      {/* Background Decorator for Big Screens */}
      <div className="hidden lg:block absolute inset-0 -z-10 opacity-20 blur-[100px]">
         <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-tiktok-pink rounded-full mix-blend-screen" />
         <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-sky-500 rounded-full mix-blend-screen" />
      </div>

    </div>
  )
}
