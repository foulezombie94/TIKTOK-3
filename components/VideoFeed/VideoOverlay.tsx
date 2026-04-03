'use client'

import { memo } from 'react'
import { Music } from 'lucide-react'

interface VideoOverlayProps {
  video: any
}

function VideoOverlay({ video }: VideoOverlayProps) {
  // 🛡️ Normalisation universelle (Flat RPC + Nested Supabase + Array Join)
  const userData = Array.isArray(video.users) ? video.users[0] : (video.users || null)
  const username = video.username || userData?.username || 'user'

  return (
    <div className="absolute bottom-20 left-4 right-16 z-20 flex flex-col gap-2 pointer-events-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
      <h3 className="font-semibold text-[17px] drop-shadow-md">@{username}</h3>
      <p className="text-[15px] font-normal leading-tight line-clamp-3 drop-shadow-md">
        {(video.caption || '').split(' ').map((word: string, i: number) => {
          if (word.startsWith('#')) {
            return <strong key={i} className="font-semibold">{word} </strong>
          }
          return word + ' '
        })}
      </p>
      
      <div className="flex items-center gap-2 mt-1 w-full max-w-[200px]">
        <Music className="w-4 h-4 shrink-0" />
        <div className="flex-1 overflow-hidden relative h-5">
           <div className="absolute whitespace-nowrap animate-marquee text-[14px]">
              {video.music_name || 'Son original'} - @{username} 
           </div>
        </div>
      </div>
    </div>
  )
}

export default memo(VideoOverlay)
