'use client'

import React, { useState } from 'react'
import { Heart, MessageCircle, Bookmark, Share2, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/store/useStore'
import toast from 'react-hot-toast'
import { FeedVideo } from '@/app/page'

interface SidebarActionsProps {
  video: FeedVideo
  onCommentClick: () => void
  currentUserId: string | null
}

const SidebarActions = ({ video, onCommentClick, currentUserId }: SidebarActionsProps) => {
  // Support hybride (nouvelle RPC unifiée + ancienne structure fallback)
  const initialLiked = video.user_has_liked ?? video._userHasLiked ?? false
  const initialLikesCount = video.likes_count ?? video.likes?.[0]?.count ?? 0
  const initialSaved = video.user_has_saved ?? video._userHasSaved ?? false
  const initialFollowing = video.user_is_following ?? video._userIsFollowing ?? false

  const [isLiked, setIsLiked] = useState(initialLiked)
  const [likesCount, setLikesCount] = useState(initialLikesCount)
  const [isSaved, setIsSaved] = useState(initialSaved)
  const followedUsers = useStore((s: any) => s.followedUsers)
  const setFollowedUser = useStore((s: any) => s.setFollowedUser)
  
  const isFollowing = followedUsers[video.user_id] ?? initialFollowing

  const setShowAuthModal = useStore((s: any) => s.setShowAuthModal)

  const handleLike = async () => {
    if (!currentUserId) {
      setShowAuthModal(true)
      return
    }

    const newLikedState = !isLiked
    setIsLiked(newLikedState)
    setLikesCount(prev => newLikedState ? prev + 1 : prev - 1)

    try {
      if (newLikedState) {
        await supabase.from('likes').insert({ user_id: currentUserId, video_id: video.id })
      } else {
        await supabase.from('likes').delete().eq('user_id', currentUserId).eq('video_id', video.id)
      }
    } catch {
      setIsLiked(!newLikedState)
      setLikesCount(prev => !newLikedState ? prev + 1 : prev - 1)
    }
  }

  const handleSave = async () => {
    if (!currentUserId) {
      setShowAuthModal(true)
      return
    }
    const newState = !isSaved
    setIsSaved(newState)
    try {
      if (newState) {
        await supabase.from('bookmarks').insert({ user_id: currentUserId, video_id: video.id })
      } else {
        await supabase.from('bookmarks').delete().eq('user_id', currentUserId).eq('video_id', video.id)
      }
    } catch {
      setIsSaved(!newState)
    }
  }

  const handleFollow = async () => {
     if (!currentUserId) {
       setShowAuthModal(true)
       return
     }
     const newState = !isFollowing
     setFollowedUser(video.user_id, newState)
     try {
        if (newState) {
           await supabase.from('follows').insert({ follower_id: currentUserId, following_id: video.user_id })
        } else {
           await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', video.user_id)
        }
     } catch {
        setFollowedUser(video.user_id, !newState) // revert on error
     }
  }

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/profile/${video.users?.username}` 
    const shareData = {
      title: `Vidéo de ${video.users?.username}`,
      text: video.caption || 'Regarde cette vidéo sur TikTok Clone',
      url: shareUrl,
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(shareUrl)
        toast.success('Lien copié dans le presse-papier !')
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        toast.error('Erreur lors du partage')
      }
    }
  }

  return (
    <div className="absolute right-2 bottom-20 flex flex-col items-center gap-5 z-20">
      {/* Profile */}
      <div className="relative mb-2">
        <div className="w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-zinc-800">
          <img src={video.users?.avatar_url} alt={video.users?.username} className="w-full h-full object-cover" />
        </div>
        {!isFollowing && currentUserId !== video.user_id && (
           <button 
             onClick={handleFollow}
             className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-tiktok-pink rounded-full flex items-center justify-center text-white"
           >
             <Plus className="w-4 h-4" />
           </button>
        )}
      </div>

      {/* Actions */}
      <button onClick={handleLike} className="flex flex-col items-center gap-1 group active:scale-90 transition-transform">
        <div className={`p-2 rounded-full transition-colors ${isLiked ? 'text-tiktok-pink' : 'text-white'}`}>
          <Heart fill={isLiked ? "currentColor" : "none"} className="w-8 h-8 drop-shadow-lg" />
        </div>
        <span className="text-xs font-semibold drop-shadow-md">{likesCount}</span>
      </button>

      <button onClick={onCommentClick} className="flex flex-col items-center gap-1 group active:scale-90 transition-transform text-white">
        <div className="p-2 rounded-full">
          <MessageCircle fill="none" className="w-8 h-8 drop-shadow-lg" />
        </div>
        <span className="text-xs font-semibold drop-shadow-md">{video.comments_count ?? video.comments?.[0]?.count ?? 0}</span>
      </button>

      <button onClick={handleSave} className="flex flex-col items-center gap-1 group active:scale-90 transition-transform">
        <div className={`p-2 rounded-full transition-colors ${isSaved ? 'text-yellow-400' : 'text-white'}`}>
          <Bookmark fill={isSaved ? "currentColor" : "none"} className="w-8 h-8 drop-shadow-lg" />
        </div>
        <span className="text-xs font-semibold drop-shadow-md">{video.bookmarks_count ?? video.bookmarks?.[0]?.count ?? 0}</span>
      </button>

      <button onClick={handleShare} className="flex flex-col items-center gap-1 group active:scale-90 transition-transform text-white">
        <div className="p-2 rounded-full">
          <Share2 className="w-8 h-8 drop-shadow-lg" />
        </div>
        <span className="text-xs font-semibold drop-shadow-md text-[10px]">Partager</span>
      </button>
    </div>
  )
}

export default React.memo(SidebarActions)
