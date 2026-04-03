'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/store/useStore'
import { Play, Heart, Bookmark, Settings, LogOut, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'
import SidebarActions from '@/components/VideoFeed/SidebarActions'
import ShareSheet from '@/components/VideoFeed/ShareSheet'

const CommentSheet = dynamic(() => import('@/components/Comments/CommentSheet'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black/50 z-[150] animate-pulse" />
})

import { FeedVideo } from '@/types/video'

interface ProfileUser {
  id: string
  username: string
  display_name: string
  avatar_url: string
  bio: string
}

enum Tab {
  POSTS = 'posts',
  LIKES = 'likes',
  BOOKMARKS = 'bookmarks'
}

export default function ProfilePage() {
  const { username } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const videoIdFromQuery = searchParams.get('v')
  
  const currentUser = useStore(s => s.currentUser)
  const isAuthLoading = useStore(s => s.isAuthLoading)
  const setCurrentUser = useStore(s => s.setCurrentUser)

  const [profile, setProfile] = useState<ProfileUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ followers: 0, following: 0, likes: 0, bookmarks: 0 })
  const [videos, setVideos] = useState<FeedVideo[]>([])
  const [activeTab, setActiveTab] = useState<Tab>(Tab.POSTS)
  const [isFollowing, setIsFollowing] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<FeedVideo | null>(null)
  const [isTogglePending, setIsTogglePending] = useState(false)
  const [commentVideoId, setCommentVideoId] = useState<string | null>(null)
  const [isShareOpen, setIsShareOpen] = useState(false)

  const isOwnProfile = profile?.id === currentUser?.id || username === 'me'

  const fetchProfileData = useCallback(async (uname: string) => {
    setLoading(true)
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', uname)
      .single()

    if (userError || !userData) {
      toast.error('Utilisateur introuvable')
      router.push('/')
      return
    }

    setProfile(userData)

    const [followersRes, followingRes, likesRes, bookmarksRes] = await Promise.all([
      supabase.from('follows').select('follower_id', { count: 'exact' }).eq('following_id', userData.id),
      supabase.from('follows').select('following_id', { count: 'exact' }).eq('follower_id', userData.id),
      supabase.from('videos').select('likes_count').eq('user_id', userData.id),
      supabase.from('bookmarks').select('id', { count: 'exact' }).eq('user_id', userData.id)
    ])

    const totalLikesReceived = likesRes.data?.reduce((acc: number, curr: any) => {
       return acc + (Number(curr.likes_count) || 0)
    }, 0) || 0

    setStats({
      followers: followersRes.count || 0,
      following: followingRes.count || 0,
      likes: totalLikesReceived,
      bookmarks: bookmarksRes.count || 0
    })

    if (currentUser && currentUser.id !== userData.id) {
       const { data } = await supabase.from('follows')
         .select('follower_id')
         .eq('follower_id', currentUser.id)
         .eq('following_id', userData.id)
         .single()
       if (data) setIsFollowing(true)
    }

    await loadVideos(Tab.POSTS, userData.id)
    setLoading(false)
  }, [currentUser, router])

  useEffect(() => {
    if (isAuthLoading) return
    let targetUsername = username as string
    if (username === 'me') {
       if (!currentUser) {
          router.push('/')
          return
       }
       targetUsername = currentUser.username
    }
    fetchProfileData(targetUsername)
  }, [username, currentUser, isAuthLoading, fetchProfileData])

  // -- 🎯 DEEP LINKING: Fetch shared video if not in grid
  useEffect(() => {
    const fetchSharedVideo = async () => {
      if (!videoIdFromQuery || selectedVideo?.id === videoIdFromQuery) return
      
      const existing = videos.find(v => v.id === videoIdFromQuery)
      if (existing) {
        setSelectedVideo(existing)
        return
      }

      const { data, error } = await supabase
        .from('videos')
        .select(`
           id, video_url, views_count, caption, music_name, created_at,
           likes_count, comments_count, bookmarks_count, slug,
           user_has_liked:likes!left(user_id),
           user_has_saved:bookmarks!left(user_id)
        `)
        .eq('id', videoIdFromQuery)
        .single()

      if (!error && data) {
        const viewerId = currentUser?.id
        const formatted = {
          ...data,
          user_has_liked: (data.user_has_liked as any)?.some((l: any) => l.user_id === viewerId),
          user_has_saved: (data.user_has_saved as any)?.some((b: any) => b.user_id === viewerId)
        }
        setSelectedVideo(formatted as unknown as FeedVideo)
      }
    }

    fetchSharedVideo()
  }, [videoIdFromQuery, videos, currentUser, selectedVideo])

  const loadVideos = async (tab: Tab, targetUserId: string) => {
    setActiveTab(tab)
    const viewerId = currentUser?.id

    if (tab === Tab.POSTS) {
      const { data } = await supabase
        .from('videos')
        .select(`
           id, video_url, views_count, caption, music_name, created_at,
           likes_count, comments_count, bookmarks_count, slug,
           user_has_liked:likes!left(user_id),
           user_has_saved:bookmarks!left(user_id)
        `)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(15)
      
      const formatted = (data || []).map((v: any) => ({
        ...v,
        user_has_liked: v.user_has_liked?.some((l: any) => l.user_id === viewerId),
        user_has_saved: v.user_has_saved?.some((b: any) => b.user_id === viewerId)
      }))
      setVideos(formatted)
    } else if (tab === Tab.LIKES) {
      const { data, error } = await supabase
        .from('likes')
        .select(`
          video_id, 
          video:video_id(
            id, video_url, views_count, caption, music_name, created_at,
            likes_count, comments_count, bookmarks_count, slug
          )
        `)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(15)
      
      if (data) {
        const extracted = data.map((d: any) => d.video).filter(Boolean)
        setVideos(extracted.map(v => ({ ...v, user_has_liked: true })))
      }
    } else if (tab === Tab.BOOKMARKS) {
      if (!isOwnProfile) {
        setVideos([])
        return
      }
      const { data, error } = await supabase
        .from('bookmarks')
        .select(`
          video_id,
          video:video_id (
            id, video_url, views_count, caption, music_name, created_at,
            likes_count, comments_count, bookmarks_count, slug
          )
        `)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(15)
      if (data) {
        const extracted = data.map((d: any) => d.video).filter(Boolean)
        setVideos(extracted.map(v => ({ ...v, user_has_saved: true })))
      }
    }
  }

  const toggleFollow = async () => {
    if (!currentUser || !profile || isTogglePending) return
    setIsTogglePending(true)
    const originalState = isFollowing
    setIsFollowing(!isFollowing)
    try {
       if (originalState) {
          await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', profile.id)
          setStats(s => ({ ...s, followers: s.followers - 1 }))
       } else {
          await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: profile.id })
          setStats(s => ({ ...s, followers: s.followers + 1 }))
       }
    } catch {
       setIsFollowing(originalState)
    } finally {
       setIsTogglePending(false)
    }
  }

  const handleLogout = async () => {
     await supabase.auth.signOut()
     setCurrentUser(null)
     router.push('/')
  }

  if (isAuthLoading || loading || !profile) {
     return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-tiktok-pink border-t-white rounded-full animate-spin"/></div>
  }

  return (
    <div className="bg-black min-h-[100dvh] pb-[60px] text-white overflow-x-hidden">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-zinc-900 sticky top-0 bg-black/80 backdrop-blur z-20">
         <div className="w-8" />
         <div className="flex-1" /> 
         <div className="w-8 flex justify-end">
            {isOwnProfile ? (
               <button onClick={handleLogout} className="text-zinc-400 p-2 hover:bg-zinc-900 rounded-full transition">
                 <LogOut className="w-5 h-5" />
               </button>
            ) : <Settings className="w-5 h-5 text-transparent" />}
         </div>
      </div>

      <div className="flex flex-col items-center pt-10 px-4">
         <div className="relative mb-4">
            <img 
               src={profile.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
               alt="Avatar" 
               className="w-[96px] h-[96px] rounded-full object-cover border-2 border-zinc-900 ring-2 ring-zinc-800/30" 
            />
         </div>
         
         <h2 className="font-bold text-xl mb-1 mt-1 tracking-tight text-white">@{profile.username}</h2>
         {profile.bio && <p className="text-sm text-zinc-400 mb-4 max-w-[80%] text-center">{profile.bio}</p>}
         
         <div className="flex justify-center items-center gap-8 mb-8 mt-6 w-full max-w-[320px]">
            <div className="flex-1 flex flex-col items-center">
               <span className="font-black text-[18px] leading-tight mb-1">{stats.following}</span>
               <span className="text-[11px] text-zinc-500 font-medium whitespace-nowrap uppercase tracking-tighter">Abonnements</span>
            </div>
            <div className="flex-1 flex flex-col items-center border-x border-zinc-900/50">
               <span className="font-black text-[18px] leading-tight mb-1">{stats.followers}</span>
               <span className="text-[11px] text-zinc-500 font-medium whitespace-nowrap px-4 uppercase tracking-tighter">Abonnés</span>
            </div>
            <div className="flex-1 flex flex-col items-center">
               <span className="font-black text-[18px] leading-tight mb-1">{stats.likes}</span>
               <span className="text-[11px] text-zinc-500 font-medium whitespace-nowrap uppercase tracking-tighter">J'aime</span>
            </div>
         </div>

         <div className="flex justify-center w-full gap-2 mb-6 max-w-[280px]">
            {isOwnProfile ? (
               <button className="flex-1 py-3 bg-zinc-800 rounded-md font-semibold text-sm hover:bg-zinc-700 w-full transition border border-zinc-700">
                  Modifier le profil
               </button>
            ) : (
               <button 
                  onClick={toggleFollow} 
                  disabled={isTogglePending}
                  className={`flex-1 py-3 rounded-md font-semibold text-sm w-full transition ${isTogglePending ? 'opacity-50 cursor-not-allowed' : ''} ${isFollowing ? 'bg-zinc-800 border border-zinc-700' : 'bg-tiktok-pink text-white'}`}
               >
                  {isFollowing ? 'Message' : 'S\'abonner'}
               </button>
            )}
            <button 
              onClick={() => setIsShareOpen(true)}
              className="p-3 bg-zinc-800 rounded-md hover:bg-zinc-700 transition border border-zinc-700 active:scale-90"
            >
               <Share2 className="w-5 h-5" />
            </button>
         </div>

         <div className="flex w-full mt-4 border-b border-zinc-800">
            <button onClick={() => loadVideos(Tab.POSTS, profile.id)} className={`flex-1 flex justify-center py-3 border-b-2 transition ${activeTab === Tab.POSTS ? 'border-white text-white' : 'border-transparent text-zinc-500'}`}>
               <svg fill="currentColor" width="22" height="22" viewBox="0 0 48 48"><path d="M14 6H34C38.4183 6 42 9.58172 42 14V34C42 38.4183 38.4183 42 34 42H14C9.58172 42 6 38.4183 6 34V14C6 9.58172 9.58172 6 14 6ZM14 10C11.7909 10 10 11.7909 10 14V34C10 36.2091 11.7909 38 14 38H34C36.2091 38 38 36.2091 38 34V14C38 11.7909 36.2091 10 34 10H14ZM18 16V32L32 24L18 16Z"></path></svg>
            </button>
            <button onClick={() => loadVideos(Tab.LIKES, profile.id)} className={`flex-1 flex justify-center py-3 border-b-2 transition ${activeTab === Tab.LIKES ? 'border-white text-white' : 'border-transparent text-zinc-500'}`}>
               <Heart fill="currentColor" className="w-[22px] h-[22px]" />
            </button>
            {isOwnProfile && (
               <button onClick={() => loadVideos(Tab.BOOKMARKS, profile.id)} className={`flex-1 flex justify-center py-3 border-b-2 transition ${activeTab === Tab.BOOKMARKS ? 'border-white text-white' : 'border-transparent text-zinc-500'}`}>
                  <Bookmark fill="currentColor" className="w-[22px] h-[22px]" />
               </button>
            )}
         </div>
      </div>

      <div className="grid grid-cols-3 gap-0.5">
         {videos.map(v => (
            <Link 
               key={v.id} 
               href={`/v/${v.slug || v.id}`}
               className="aspect-[3/4] bg-zinc-900 relative group overflow-hidden border border-zinc-800/10 cursor-pointer"
            >
               <video 
                  src={v.video_url} 
                  className="w-full h-full object-cover pointer-events-none" 
               />
               <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-[11px] font-bold drop-shadow-md">
                  <Play className="w-3 h-3 fill-current" />
                  {v.views_count}
               </div>
               <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
         ))}
         {videos.length === 0 && !loading && (
            <div className="col-span-3 py-16 text-center text-zinc-500 text-sm">
               Aucune vidéo disponible
            </div>
         )}
      </div>

      {/* Modal is now handled by Parallel & Intercepting Routes (@modal slot in layout) */}

      <AnimatePresence>
        {commentVideoId && (
          <CommentSheet
            videoId={commentVideoId}
            onClose={() => setCommentVideoId(null)}
          />
        )}
      </AnimatePresence>

      <ShareSheet 
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        mode="profile"
        video={{
          id: profile.id,
          users: { username: profile.username },
          caption: `Découvre le profil de @${profile.username} sur TikTok Clone !`
        } as any}
      />
    </div>
  )
}
