'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { FeedVideo } from '@/types/video'
import VideoDetail from './VideoDetail'

interface VideoModalProps {
  video: FeedVideo
}

export default function VideoModal({ video }: VideoModalProps) {
  const router = useRouter()
  const [isClosing, setIsClosing] = useState(false)

  // 🚪 Close handler
  const handleClose = () => {
    setIsClosing(true)
    router.back()
  }

  // ⌨️ Escape key support
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  if (!video) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-10 lg:p-16">
      {/* 🌑 Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
      />

      {/* 📦 Main Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full h-full max-w-[1200px]"
      >
        <VideoDetail 
          video={video} 
          onClose={handleClose} 
          isModal={true} 
        />
      </motion.div>
    </div>
  )
}

