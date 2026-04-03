import { useRouter } from 'next/navigation'
import { FeedVideo } from '@/types/video'
import VideoDetail from './VideoDetail'

interface StandaloneVideoPageProps {
  initialVideo: FeedVideo
}

export default function StandaloneVideoPage({ initialVideo }: StandaloneVideoPageProps) {
  const router = useRouter()

  if (!initialVideo) return null

  return (
    <div className="fixed inset-0 bg-black z-[100]">
      <VideoDetail 
        video={initialVideo} 
        onClose={() => router.push('/')} 
        isModal={false} 
      />
    </div>
  )
}
