'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import VideoPlayer from '@/components/VideoFeed/VideoPlayer'
import SidebarActions from '@/components/VideoFeed/SidebarActions'
import VideoOverlay from '@/components/VideoFeed/VideoOverlay'
import { useStore } from '@/store/useStore'
import { AnimatePresence } from 'framer-motion'

// Optimisation : Chargement dynamique du composant lourd
const CommentSheet = dynamic(() => import('@/components/Comments/CommentSheet'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black/50 z-50 animate-pulse" />
})

export interface FeedVideo {
  id: string
  user_id: string
  video_url: string
  thumbnail_url?: string
  caption: string
  music_name: string
  views_count: number
  created_at: string
  users: {
    id: string
    username: string
    display_name: string
    avatar_url: string
  }
  likes_count: number
  comments_count: number
  bookmarks_count: number
  user_has_liked?: boolean
  user_has_saved?: boolean
  user_is_following?: boolean
  // Support fallback pour l'ancienne structure si besoin
  likes?: { count: number }[]
  comments?: { count: number }[]
  bookmarks?: { count: number }[]
  _userHasLiked?: boolean
  _userHasSaved?: boolean
  _userIsFollowing?: boolean
}

export default function HomePage() {
  const [videos, setVideos] = useState<FeedVideo[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [commentVideoId, setCommentVideoId] = useState<string | null>(null)
  
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [nextCursorId, setNextCursorId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const VIDEOS_PER_PAGE = 6

  const currentUser = useStore((s: any) => s.currentUser)
  const isAuthLoading = useStore((s: any) => s.isAuthLoading)

  const VIEW_DURATION_MS = 2000;
  const viewTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const trackedVideosRef = useRef<Set<string>>(new Set());

  const WINDOW_SIZE = 1 

  const fetchVideosBatch = useCallback(async (cursor: string | null, cursorId: string | null) => {
    // Phase Production : Appel RPC par Curseur (Déterministe et performant)
    const { data: vidsData, error } = await supabase.rpc('get_fyp_videos', {
      p_user_id: currentUser?.id || '00000000-0000-0000-0000-000000000000',
      p_cursor: cursor,
      p_cursor_id: cursorId,
      p_limit: VIDEOS_PER_PAGE
    })

    if (error) {
      console.error('Feed RPC failure:', error)
      return []
    }

    if (!vidsData || vidsData.length === 0) {
      setHasMore(false)
      return []
    }

    return vidsData as unknown as FeedVideo[]
  }, [currentUser])

  useEffect(() => {
    if (isAuthLoading) return
    let isMounted = true

    const initLoad = async () => {
      setLoading(true)
      const initialVideos = await fetchVideosBatch(null, null)
      if (isMounted) {
        setVideos(initialVideos)
        if (initialVideos.length > 0) {
          const lastVideo = initialVideos[initialVideos.length - 1]
          setNextCursor(lastVideo.created_at)
          setNextCursorId(lastVideo.id)
        }
        setLoading(false)
      }
    }
    initLoad()

    return () => { isMounted = false }
  }, [currentUser, isAuthLoading, fetchVideosBatch])

  const loadMoreVideos = useCallback(async () => {
    if (isLoadingMore || !hasMore || !nextCursor) return
    setIsLoadingMore(true)
    const nextVideos = await fetchVideosBatch(nextCursor, nextCursorId)
    if (nextVideos.length > 0) {
      setVideos(prev => [...prev, ...nextVideos])
      const lastVideo = nextVideos[nextVideos.length - 1]
      setNextCursor(lastVideo.created_at)
      setNextCursorId(lastVideo.id)
    }
    setIsLoadingMore(false)
  }, [nextCursor, nextCursorId, isLoadingMore, hasMore, fetchVideosBatch])

  const trackVideoView = async (videoId: string) => {
    if (!currentUser || trackedVideosRef.current.has(videoId)) return;
    
    trackedVideosRef.current.add(videoId);
    await supabase.from('video_views').upsert({
      user_id: currentUser.id,
      video_id: videoId
    }, { onConflict: 'user_id,video_id' })
  }

  const handleInView = useCallback((index: number, inView: boolean) => {
    const videoId = videos[index]?.id;
    if (!videoId) return;

    if (inView) {
      setActiveIndex(index)
      
      // Valider la vue après X secondes
      viewTimeoutsRef.current[videoId] = setTimeout(() => {
         trackVideoView(videoId);
      }, VIEW_DURATION_MS);

      if (index >= videos.length - 2) {
        loadMoreVideos()
      }
    } else {
      // Annuler si l'utilisateur scrolle trop vite
      if (viewTimeoutsRef.current[videoId]) {
        clearTimeout(viewTimeoutsRef.current[videoId]);
      }
    }
  }, [videos, loadMoreVideos, currentUser])

  if (loading || isAuthLoading) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-tiktok-pink border-t-transparent rounded-full animate-spin" />
          <p className="text-tiktok-gray text-sm font-medium animate-pulse">Initialisation du Feed...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[100dvh] w-full bg-black relative">
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-center pt-safe pb-2 pointer-events-none">
        <div className="flex items-center gap-6">
          <span className="text-white/60 text-[15px] font-medium cursor-pointer pointer-events-auto">Abonnements</span>
          <span className="text-white text-[15px] font-bold border-b-2 border-white pb-0.5 pointer-events-auto cursor-pointer">Pour toi</span>
        </div>
      </div>

      <div className="snap-container scrollbar-hide h-full w-full">
        {videos.map((video, index) => {
          const isNearby = Math.abs(index - activeIndex) <= WINDOW_SIZE;

          return (
            <div key={`${video.id}-${index}`} className="snap-item relative h-full w-full bg-black">
              {isNearby ? (
                <>
                  <VideoPlayer
                    video={video}
                    index={index}
                    activeIndex={activeIndex}
                    onInView={handleInView}
                  />
                  <VideoOverlay video={video} />
                  <SidebarActions
                    video={video}
                    onCommentClick={() => setCommentVideoId(video.id)}
                    currentUserId={currentUser?.id || null}
                  />
                </>
              ) : (
                <div className="w-full h-full bg-black" />
              )}
            </div>
          )
        })}
      </div>

      <AnimatePresence>
        {commentVideoId && (
          <CommentSheet
            videoId={commentVideoId}
            onClose={() => setCommentVideoId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
