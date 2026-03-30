'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/store/useStore'
import { Play, Heart, Bookmark, Settings, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'

interface ProfileUser {
  id: string
  username: string
  display_name: string
  avatar_url: string
  bio: string
}

interface Video {
  id: string
  video_url: string
  views_count: number
}

enum Tab {
  POSTS = 'posts',
  LIKES = 'likes',
  BOOKMARKS = 'bookmarks'
}

export default function ProfilePage() {
  const { username } = useParams()
  const router = useRouter()
  
  const currentUser = useStore(s => s.currentUser)
  const setCurrentUser = useStore(s => s.setCurrentUser)
  const isAuthLoading = useStore(s => s.isAuthLoading)

  const [profile, setProfile] = useState<ProfileUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ followers: 0, following: 0, likes: 0 })
  const [videos, setVideos] = useState<Video[]>([])
  const [activeTab, setActiveTab] = useState<Tab>(Tab.POSTS)
  const [isFollowing, setIsFollowing] = useState(false)

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

    const [followersRes, followingRes, likesRes] = await Promise.all([
      supabase.from('follows').select('follower_id', { count: 'exact' }).eq('following_id', userData.id),
      supabase.from('follows').select('following_id', { count: 'exact' }).eq('follower_id', userData.id),
      supabase.from('videos').select('likes(count)').eq('user_id', userData.id)
    ])

    const totalLikesReceived = likesRes.data?.reduce((acc: number, curr: { likes: { count: number }[] }) => {
       return acc + (curr.likes[0]?.count || 0)
    }, 0) || 0

    setStats({
      followers: followersRes.count || 0,
      following: followingRes.count || 0,
      likes: totalLikesReceived
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
    // SECURITY: Prevent unjustified kicks by waiting for auth check
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

  const loadVideos = async (tab: Tab, targetUserId: string) => {
    setActiveTab(tab)
    if (tab === Tab.POSTS) {
      const { data } = await supabase.from('videos').select('id, video_url, views_count').eq('user_id', targetUserId).order('created_at', { ascending: false }).limit(15)
      setVideos(data || [])
    } else if (tab === Tab.LIKES) {
      const { data } = await supabase.from('likes').select('video_id, videos(id, video_url, views_count)').eq('user_id', targetUserId).order('created_at', { ascending: false }).limit(15)
      if (data) {
        // PERF: filter(Boolean) protects against videos that were deleted by creator but still technically liked in DB
        setVideos(data.map((d: { videos: any }) => d.videos).filter(Boolean))
      }
    } else if (tab === Tab.BOOKMARKS) {
      const { data } = await supabase.from('bookmarks').select('video_id, videos(id, video_url, views_count)').eq('user_id', targetUserId).order('created_at', { ascending: false }).limit(15)
      if (data) {
        setVideos(data.map((d: { videos: any }) => d.videos).filter(Boolean))
      }
    }
  }

  const toggleFollow = async () => {
    if (!currentUser || !profile) return
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
    <div className="bg-black min-h-[100dvh] pb-[60px] text-white">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-zinc-900 sticky top-0 bg-black/80 backdrop-blur z-10">
         <div className="w-8" />
         <h1 className="font-bold text-lg">{profile.display_name}</h1>
         <div className="w-8 flex justify-end">
            {isOwnProfile ? (
               <button onClick={handleLogout} className="text-zinc-400 p-1">
                 <LogOut className="w-5 h-5" />
               </button>
            ) : <Settings className="w-5 h-5 text-transparent" />}
         </div>
      </div>

      <div className="flex flex-col items-center pt-6 px-4">
         <img src={profile.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} alt="Avatar" className="w-[100px] h-[100px] rounded-full object-cover mb-4 border border-zinc-800" />
         <h2 className="font-semibold text-xl mb-1 mt-1">@{profile.username}</h2>
         {profile.bio && <p className="text-sm text-zinc-300 mb-4">{profile.bio}</p>}

         {/* Stats */}
         <div className="flex gap-8 mb-6 mt-2">
            <div className="flex flex-col items-center">
               <span className="font-bold text-[17px]">{stats.following}</span>
               <span className="text-xs text-zinc-500">Abonnements</span>
            </div>
            <div className="flex flex-col items-center">
               <span className="font-bold text-[17px]">{stats.followers}</span>
               <span className="text-xs text-zinc-500">Abonnés</span>
            </div>
            <div className="flex flex-col items-center">
               <span className="font-bold text-[17px]">{stats.likes}</span>
               <span className="text-xs text-zinc-500">J&apos;aime</span>
            </div>
         </div>

         {/* Actions */}
         <div className="flex justify-center w-full gap-2 mb-6 max-w-[280px]">
            {isOwnProfile ? (
               <button className="flex-1 py-3 bg-zinc-800 rounded-md font-semibold text-sm hover:bg-zinc-700 w-full transition border border-zinc-700">
                  Modifier le profil
               </button>
            ) : (
               <button onClick={toggleFollow} className={`flex-1 py-3 rounded-md font-semibold text-sm w-full transition ${isFollowing ? 'bg-zinc-800 border border-zinc-700' : 'bg-tiktok-pink text-white'}`}>
                  {isFollowing ? 'Message' : 'S&apos;abonner'}
               </button>
            )}
         </div>

         {/* Tabs */}
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

      {/* Grid */}
      <div className="grid grid-cols-3 gap-0.5">
         {videos.map(v => (
            <div key={v.id} className="aspect-[3/4] bg-zinc-900 border border-zinc-900 relative group cursor-pointer">
               <video src={v.video_url} className="w-full h-full object-cover" />
               <div className="absolute inset-0 bg-black/10 transition group-hover:bg-black/40" />
               <div className="absolute bottom-2 left-2 flex items-center text-white text-xs font-semibold drop-shadow-md z-1">
                  <Play className="w-3 h-3 mr-1 fill-white" />
                  {v.views_count}
               </div>
            </div>
         ))}
         {videos.length === 0 && (
            <div className="col-span-3 py-16 text-center text-zinc-500 text-sm">
               Aucune vidéo disponible
            </div>
         )}
      </div>
    </div>
  )
}
