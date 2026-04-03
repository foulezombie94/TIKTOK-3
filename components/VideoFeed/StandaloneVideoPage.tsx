'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Music, Share2 } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import SidebarActions from './SidebarActions' // Nettoyage imports: plus de X, Play, MoreVertical ou VideoPlayer inutile
import { useStore } from '@/store/useStore'

const CommentSheet = dynamic(() => import('@/components/Comments/CommentSheet'), {
  ssr: false,
})

interface StandaloneVideoPageProps {
  initialVideo: any
}

export default function StandaloneVideoPage({ initialVideo }: StandaloneVideoPageProps) {
  const [video] = useState(initialVideo)
  const [commentVideoId, setCommentVideoId] = useState<string | null>(null)
  const currentUser = useStore((s: any) => s.currentUser)

  if (!video) return null

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col md:flex-row overflow-hidden z-[100]">
      {/* 🧭 Navigation */}
      <div className="absolute top-0 left-0 right-0 h-16 px-4 flex items-center justify-between z-50 bg-gradient-to-b from-black/60 to-transparent">
        <Link 
          href="/"
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-all active:scale-95"
        >
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div className="px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/10">
          <span className="text-sm font-bold tracking-tight">Regarder</span>
        </div>
        <div className="w-10" />
      </div>

      {/* 📱 Zone Vidéo (Plein Écran) */}
      <div className="relative flex-1 h-full bg-zinc-950 flex items-center justify-center">
        <div className="relative w-full h-full max-w-[500px] aspect-[9/16] shadow-[0_0_100px_rgba(0,0,0,0.8)]">
           {/* 📱 3. Politique d'Autoplay Mobile (muted + playsInline) */}
           <video 
             src={video.video_url}
             className="w-full h-full object-contain"
             autoPlay
             muted
             playsInline
             loop
             controls
           />
           
           <div className="absolute bottom-6 left-4 right-20 pointer-events-none drop-shadow-2xl">
              <div className="flex items-center gap-3 mb-3">
                 <Link href={`/profile/${video.users?.username}`} className="pointer-events-auto">
                    <img 
                      src={video.users?.avatar_url} 
                      className="w-10 h-10 rounded-full border-2 border-white shadow-lg"
                      alt={video.users?.username}
                    />
                 </Link>
                 <div className="flex flex-col">
                    <span className="font-bold text-[17px]">@{video.users?.username}</span>
                    <span className="text-xs opacity-80">{video.users?.display_name}</span>
                 </div>
              </div>
              <p className="text-[15px] mb-3 line-clamp-3 leading-snug">{video.caption}</p>
              <div className="flex items-center gap-2 bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-sm border border-white/5">
                 <Music className="w-3 h-3" />
                 <span className="text-xs font-medium truncate max-w-[150px]">{video.music_name || 'Original Audio'}</span>
              </div>
           </div>

           <div className="absolute right-2 bottom-[10%] z-20">
              <SidebarActions 
                video={video}
                currentUserId={currentUser?.id}
                onCommentClick={() => setCommentVideoId(video.id)}
              />
           </div>
        </div>
      </div>

      {/* 💻 Desktop Sidebar */}
      <div className="hidden lg:flex w-[400px] border-l border-white/10 flex-col bg-zinc-950">
         <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-4">
                  <Link href={`/profile/${video.users?.username}`}>
                    <img 
                      src={video.users?.avatar_url} 
                      className="w-12 h-12 rounded-full border border-white/20 hover:opacity-80 transition"
                      alt={video.users?.username}
                    />
                  </Link>
                  <div>
                     <Link href={`/profile/${video.users?.username}`}>
                       <h2 className="font-bold text-lg hover:underline transition tracking-tight">@{video.users?.username}</h2>
                     </Link>
                     <p className="text-sm text-zinc-400">{video.users?.display_name}</p>
                  </div>
               </div>
               <button className="bg-tiktok-pink text-white px-6 py-2 rounded-md font-bold hover:bg-tiktok-pink/90 transition-all active:scale-95">
                  Suivre
               </button>
            </div>
            <p className="text-white/90 text-[15px] leading-relaxed mb-4">{video.caption}</p>
            <div className="flex items-center gap-2 text-zinc-400 text-sm">
               <Music className="w-4 h-4" />
               <span className="font-semibold">{video.music_name || 'Original Audio'}</span>
            </div>
         </div>

         {/* 🧹 4. Nettoyage & Discussion Desktop */}
         <div className="flex-1 overflow-y-auto p-6 bg-black/40">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-6">Discussion</h3>
            
            {!currentUser ? (
               <div className="flex flex-col items-center justify-center h-full opacity-30 text-center px-10">
                  <Share2 className="w-12 h-12 mb-4" />
                  <p className="text-sm font-medium">Connectez-vous pour voir les commentaires et rejoindre la discussion !</p>
               </div>
            ) : (
               <div className="flex flex-col items-center justify-center h-full opacity-40 text-center px-10 italic">
                  <p className="text-sm">Les commentaires sont en cours de chargement...</p>
               </div>
            )}
         </div>
      </div>

      <AnimatePresence>
        {commentVideoId && (
          <CommentSheet 
            videoId={video.id}
            onClose={() => setCommentVideoId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
