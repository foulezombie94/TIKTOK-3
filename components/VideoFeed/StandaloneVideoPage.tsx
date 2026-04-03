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
  
  // 🛡️ Validation Hydratation suggérée par l'utilisateur (Principal Grade)
  useEffect(() => {
    console.log("🚀 [ELITE] Vidéo reçue du serveur :", initialVideo?.id)
  }, [initialVideo])

  const [videos, setVideos] = useState<FeedVideo[]>([initialVideo])
  const [activeIndex, setActiveIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(initialVideo?.created_at || null)
  const [nextCursorId, setNextCursorId] = useState<string | null>(initialVideo?.id || null)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [commentVideoId, setCommentVideoId] = useState<string | null>(null)

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

      // Filtrer pour éviter les doublons (la initialVideo pourrait revenir du feed)
      const filteredVids = data.filter((v: FeedVideo) => v.id !== initialVideo.id)
      
      setVideos(prev => [...prev, ...filteredVids])
      const lastVideo = data[data.length - 1]
      setNextCursor(lastVideo.created_at)
      setNextCursorId(lastVideo.id)
    } finally {
      setIsLoadingMore(false)
    }
  }, [currentUser, nextCursor, nextCursorId, isLoadingMore, hasMore, initialVideo.id])

  // Scroll observer pour l'infini
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    const index = Math.round(scrollTop / clientHeight)
    if (index !== activeIndex) setActiveIndex(index)

    // Déclencher le load more quand on approche de la fin
    if (scrollHeight - scrollTop <= clientHeight * 2) {
      fetchMoreVideos()
    }
  }

  if (!initialVideo) return null

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col md:flex-row overflow-hidden font-sans">
      
      {/* ⬅️ Back Button */}
      <button 
        onClick={() => router.push('/')}
        className="absolute top-6 left-6 z-[110] p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-xl transition-all active:scale-95 border border-white/10 text-white shadow-2xl"
      >
        <ArrowLeft className="w-6 h-6" />
      </button>

      {/* 🎬 Main Video Feed Section (Left/Full) */}
      <div 
        className="relative flex-1 h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide bg-zinc-950"
        onScroll={handleScroll}
      >
        {videos.map((video, index) => (
          <div key={`${video.id}-${index}`} className="relative h-full w-full snap-start snap-always">
             <VideoPlayer 
               video={video} 
               isActive={index === activeIndex} 
             />
             
             {/* Feed Overlays */}
             <VideoOverlay video={video} />
             
             <SidebarActions 
                video={video as any}
                currentUserId={currentUser?.id}
                onCommentClick={() => setCommentVideoId(video.id)}
             />
          </div>
        ))}

        {isLoadingMore && (
          <div className="h-20 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-tiktok-pink" />
          </div>
        )}
      </div>

      {/* 📝 Comment Section (Right - Desktop only) */}
      <div className="hidden md:flex w-[450px] bg-zinc-950 border-l border-white/5 flex-col z-[105]">
          <CommentSheet 
            videoId={videos[activeIndex]?.id || initialVideo.id}
            onClose={() => {}}
            isInline={true}
          />
      </div>

      {/* Mobile Comment Modal */}
      <AnimatePresence>
        {commentVideoId && (
          <div className="md:hidden">
            <CommentSheet 
              videoId={commentVideoId}
              onClose={() => setCommentVideoId(null)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
