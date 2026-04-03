'use client'

import React, { useState } from 'react'
import { Heart, MessageCircle, Bookmark, Share2, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/store/useStore'
import toast from 'react-hot-toast'
import { FeedVideo } from '@/app/page'
import ShareSheet from './ShareSheet'

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
  const [bookmarksCount, setBookmarksCount] = useState(video.bookmarks_count ?? video.bookmarks?.[0]?.count ?? 0)
  const [isShareOpen, setIsShareOpen] = useState(false)
  
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
    setBookmarksCount(prev => newState ? prev + 1 : prev - 1)

    try {
      let result;
      if (newState) {
        result = await supabase.from('bookmarks').insert({ user_id: currentUserId, video_id: video.id })
      } else {
        result = await supabase.from('bookmarks').delete().eq('user_id', currentUserId).eq('video_id', video.id)
      }
      
      if (result.error) {
         // CAS CRITIQUE : Si le favori existe déjà (Duplicate Key), on synchronise l'UI en jaune
         if (result.error.code === '23505') {
            console.log('Synchronisation forcée : Le favori existe déjà en base.')
            setIsSaved(true)
            // On s'assure que le compteur est correct
            return 
         }
         throw new Error(result.error.message)
      }
    } catch (err: any) {
      // On ne revert que si ce n'est pas un problème de doublon
      setIsSaved(!newState)
      setBookmarksCount(prev => !newState ? prev + 1 : prev - 1)
      toast.error(`Action impossible: ${err.message}`)
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

  const handleShare = () => {
    setIsShareOpen(true)
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
      <div className="flex flex-col gap-4 items-center">
        <div className="flex flex-col items-center">
          <button onClick={handleLike} className="flex flex-col items-center group">
            <div className={`p-2 rounded-full transition-all duration-300 ${isLiked ? 'text-tiktok-pink scale-110' : 'text-white group-hover:bg-zinc-800'}`}>
              <Heart fill={isLiked ? "currentColor" : "none"} className="w-7 h-7 drop-shadow-lg" />
            </div>
            <span className="text-xs font-semibold drop-shadow-md">{likesCount}</span>
          </button>
        </div>

        <div className="flex flex-col items-center">
          <button onClick={onCommentClick} className="flex flex-col items-center group">
            <div className="p-2 rounded-full text-white group-hover:bg-zinc-800 transition-colors">
              <MessageCircle fill="currentColor" className="w-7 h-7 drop-shadow-lg" />
            </div>
            <span className="text-xs font-semibold drop-shadow-md">{video.comments_count ?? video.comments?.[0]?.count ?? 0}</span>
          </button>
        </div>

        <div className="flex flex-col items-center">
          <button onClick={handleSave} className="flex flex-col items-center group">
            {/* Jaune TikTok si actif, Gris zinc-400 si inactif */}
            <div className={`p-2 rounded-full transition-all duration-300 ${isSaved ? 'text-[#FACE15] scale-115' : 'text-zinc-400 group-hover:bg-zinc-800'}`}>
              <Bookmark fill={isSaved ? "currentColor" : "none"} className="w-7 h-7 drop-shadow-lg" />
            </div>
            <span className="text-xs font-semibold drop-shadow-md text-white">{bookmarksCount}</span>
          </button>
        </div>

        <button onClick={handleShare} className="flex flex-col items-center gap-1 group active:scale-90 transition-transform text-white">
          <div className="p-2 rounded-full">
            <Share2 className="w-8 h-8 drop-shadow-lg" />
          </div>
          <span className="text-xs font-semibold drop-shadow-md text-[10px]">Partager</span>
        </button>
      </div>

      <ShareSheet 
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        video={video as any}
      />
    </div>
  )
}

export default React.memo(SidebarActions)
