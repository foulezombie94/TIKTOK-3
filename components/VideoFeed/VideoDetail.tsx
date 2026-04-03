'use client'

import { useState } from 'react'
import { Music, MessageCircle, Heart, Bookmark, UserPlus, Share2, ArrowLeft } from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import SidebarActions from './SidebarActions'
import { useStore } from '@/store/useStore'
import { FeedVideo } from '@/types/video'

const CommentSheet = dynamic(() => import('@/components/Comments/CommentSheet'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-zinc-900/50 animate-pulse rounded-xl" />
})

interface VideoDetailProps {
  video: FeedVideo
  onClose?: () => void
  isModal?: boolean
}

export default function VideoDetail({ video, onClose, isModal = false }: VideoDetailProps) {
  const currentUser = useStore((s: any) => s.currentUser)
  const [commentVideoId, setCommentVideoId] = useState<string | null>(null)

  if (!video) return null

  return (
    <div className={`relative w-full h-full flex flex-col md:flex-row bg-zinc-950 overflow-hidden ${isModal ? 'md:rounded-2xl border border-white/5 shadow-[0_0_100px_rgba(0,0,0,0.5)]' : ''}`}>
      
      {/* ⬅️ Back/Close Button */}
      <div className="absolute top-6 left-6 z-50 flex items-center gap-4">
        {onClose && (
          <button 
            onClick={onClose}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-xl transition-all active:scale-90 border border-white/10 group shadow-lg"
          >
            {isModal ? (
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <ArrowLeft className="w-6 h-6 text-white" />
            )}
          </button>
        )}
        {!isModal && (
          <div className="px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/10 hidden md:block">
            <span className="text-sm font-bold tracking-tight text-white/90">Mode Visionnage</span>
          </div>
        )}
      </div>

      {/* 🎬 Video Section (Left) */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        {/* Background Blurred Image - Fixed: Secure img instead of vulnerable inline-style */}
        <img 
          src={video.thumbnail_url || video.video_url}
          className="absolute inset-0 w-full h-full object-cover opacity-20 blur-[100px] scale-150 pointer-events-none"
          alt=""
        />
        
        <video 
          src={video.video_url}
          className="relative h-full w-full object-contain z-10"
          autoPlay 
          loop 
          controls 
          playsInline
        />

        {/* Mobile Overlay Actions (Visible only on mobile) */}
        <div className="absolute right-4 bottom-10 md:hidden z-20">
           <SidebarActions 
              video={video}
              currentUserId={currentUser?.id}
              onCommentClick={() => setCommentVideoId(video.id)}
           />
        </div>
      </div>

      {/* 📝 Details Section (Right) */}
      <div className="w-full md:w-[400px] lg:w-[450px] bg-zinc-950 flex flex-col border-l border-white/5 z-20 overflow-hidden">
        <div className="p-6 border-b border-white/5 bg-zinc-900/20 backdrop-blur-md">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link href={`/profile/${video.users?.username}`} className="relative shrink-0">
                <img 
                  src={video.users?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                  className="w-12 h-12 rounded-full border border-white/10 hover:opacity-80 transition-opacity"
                  alt={video.users?.username}
                />
                <div className="absolute -bottom-1 -right-1 bg-tiktok-pink rounded-full p-0.5 border-2 border-zinc-950">
                  <UserPlus className="w-3 h-3 text-white" fill="currentColor" />
                </div>
              </Link>
              <div>
                <Link href={`/profile/${video.users?.username}`}>
                  <h2 className="font-bold text-lg hover:underline transition decoration-2 underline-offset-4 tracking-tight">@{video.users?.username}</h2>
                </Link>
                <p className="text-sm text-zinc-400 font-medium truncate max-w-[180px]">{video.users?.display_name}</p>
              </div>
            </div>
            <button className="bg-tiktok-pink text-white px-7 py-2 rounded-full font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-tiktok-pink/20">
              Suivre
            </button>
          </div>

          <div className="space-y-4">
            <p className="text-white/90 text-[15px] leading-relaxed line-clamp-4 font-medium tracking-tight whitespace-pre-wrap">
              {video.caption}
            </p>
            
            <div className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors cursor-pointer w-fit">
              <Music className="w-4 h-4" />
              <span className="text-sm font-semibold truncate max-w-[200px]">
                {video.music_name || 'Original Audio - '+video.users?.username}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6 mt-6 py-4 px-2 bg-white/5 rounded-xl border border-white/5">
            <div className="flex-1 flex items-center justify-center gap-2 group cursor-pointer border-r border-white/5">
              <Heart className={`w-5 h-5 ${video.user_has_liked ? 'fill-tiktok-pink text-tiktok-pink' : 'text-white'}`} />
              <span className="text-sm font-bold">{video.likes_count || 0}</span>
            </div>
            <div className="flex-1 flex items-center justify-center gap-2 group cursor-pointer border-r border-white/5">
              <MessageCircle className="w-5 h-5 text-white" />
              <span className="text-sm font-bold">{video.comments_count || 0}</span>
            </div>
            <div className="flex-1 flex items-center justify-center gap-2 group cursor-pointer">
              <Bookmark className={`w-5 h-5 ${video.user_has_saved ? 'fill-yellow-400 text-yellow-400' : 'text-white'}`} />
              <span className="text-sm font-bold">{video.bookmarks_count || 0}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col bg-black/40">
          {currentUser ? (
            <CommentSheet 
              videoId={video.id}
              onClose={() => {}} 
              isInline={true}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-10 text-center opacity-40">
              <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                <Share2 className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold mb-1">Connectez-vous pour voir les commentaires</p>
              <p className="text-xs">Rejoignez la discussion autour de cette vidéo !</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
