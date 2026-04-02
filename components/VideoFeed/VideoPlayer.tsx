'use client'

import { useRef, useEffect, useState, useCallback, memo } from 'react'
import { useInView } from 'react-intersection-observer'
import { useStore } from '@/store/useStore'
import { Volume2, VolumeX, Play } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface VideoPlayerProps {
  video: {
    id: string
    video_url: string
    user_id: string
    thumbnail_url?: string
  }
  index: number
  activeIndex: number
  onInView: (index: number, inView: boolean) => void
}

function VideoPlayer({ video, index, activeIndex, onInView }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([])
  
  const lastTapRef = useRef<number>(0)
  const heartIdRef = useRef(0)
  const timeoutRefs = useRef(new Set<NodeJS.Timeout>())

  const isMuted = useStore((s: any) => s.isMuted)
  const setIsMuted = useStore((s: any) => s.setIsMuted)
  const currentUser = useStore((s: any) => s.currentUser)
  const setShowAuthModal = useStore((s: any) => s.setShowAuthModal)

  const { ref: inViewRef, inView } = useInView({ threshold: 0.6 })
  const isActive = index === activeIndex

  // Notify parent of visibility changes
  useEffect(() => {
    onInView(index, inView)
  }, [inView, index, onInView])

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      inViewRef(node)
    },
    [inViewRef]
  )

  // Auto play/pause with smarter preload
  useEffect(() => {
    const vid = videoRef.current
    if (!vid) return

    if (isActive) {
      vid.play().catch((err) => {
        if (err.name === 'NotAllowedError') {
           setIsMuted(true)
           vid.muted = true
           vid.play().catch(() => setIsPaused(true))
        }
      })
      setIsPaused(false)
    } else {
      vid.pause()
      vid.currentTime = 0 
    }
  }, [isActive, setIsMuted])

  useEffect(() => {
    const timeouts = timeoutRefs.current
    return () => {
      timeouts.forEach(clearTimeout)
      timeouts.clear()
    }
  }, [])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted
    }
  }, [isMuted])

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now()
    const timeSinceLastTap = now - lastTapRef.current
    lastTapRef.current = now

    // Double tap detection (doesn't block single tap)
    if (timeSinceLastTap < 300) {
      handleDoubleTap(e)
      return
    }

    // Single tap: Toggle play/pause INSTANTLY (no 300ms delay)
    const vid = videoRef.current
    if (!vid) return
    if (vid.paused) {
      vid.play().catch(() => setIsPaused(true))
      setIsPaused(false)
    } else {
      vid.pause()
      setIsPaused(true)
    }
  }

  const handleDoubleTap = async (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const newHeart = { id: heartIdRef.current++, x, y }
    setHearts((prev) => [...prev, newHeart])

    const cleanupTimer = setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== newHeart.id))
      timeoutRefs.current.delete(cleanupTimer)
    }, 800)
    timeoutRefs.current.add(cleanupTimer)

    if (!currentUser) {
      setShowAuthModal(true)
      return
    }

    // Direct insert with ignore policy (performance win: -1 roundtrip)
    try {
      await supabase.from('likes').insert({
        user_id: currentUser.id,
        video_id: video.id,
      })
    } catch {
      // Ignore errors if already liked
    }
  }

  // Preload strategy: auto for active and next, metadata for far, none for rest
  let preloadStrategy: "auto" | "metadata" | "none" = "none"
  if (isActive || index === activeIndex + 1) {
    preloadStrategy = "auto"
  } else if (Math.abs(index - activeIndex) <= 2) {
    preloadStrategy = "metadata"
  }

  return (
    <div ref={setRefs} className="relative w-full h-full bg-black group overflow-hidden" onClick={handleTap}>
      <video
        ref={videoRef}
        src={video.video_url}
        poster={video.thumbnail_url}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ width: '100%', height: '100%' }} // Stabilisation CLS
        loop
        muted={isMuted}
        playsInline
        preload={preloadStrategy}
      />

      <AnimatePresence>
        {isPaused && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.7, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <Play className="w-20 h-20 text-white/80 fill-white/80" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 pointer-events-none">
        <AnimatePresence>
          {hearts.map((heart) => (
            <motion.div
              key={heart.id}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 1.5, opacity: 0, y: -100 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="absolute pointer-events-none z-40"
              style={{ left: heart.x - 30, top: heart.y - 30 }}
            >
              <Heart className="w-[60px] h-[60px] text-tiktok-pink fill-tiktok-pink drop-shadow-2xl" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsMuted(!isMuted)
        }}
        className="absolute bottom-24 right-4 z-30 p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-all active:scale-90"
      >
        {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
      </button>
    </div>
  )
}

export default memo(VideoPlayer)
