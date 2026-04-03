'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Send, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/store/useStore'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { sanitizeText } from '@/lib/sanitize'

interface Comment {
  id: string
  content: string
  created_at: string
  users: {
    username: string
    avatar_url: string
  }
}

interface CommentSheetProps {
  videoId: string
  onClose: () => void
  isInline?: boolean
}

// 🧱 Sub-components moved OUTSIDE to prevent re-mounts on parent re-render (fixes focus loss)
const CommentList = ({ 
  loading, 
  comments, 
  messagesEndRef 
}: { 
  loading: boolean, 
  comments: Comment[], 
  messagesEndRef: React.RefObject<HTMLDivElement> 
}) => (
  <div className="flex-1 overflow-y-auto p-4 scrollbar-hide flex flex-col gap-4">
    {loading ? (
      <div className="flex items-center justify-center h-full py-10">
        <Loader2 className="w-6 h-6 animate-spin text-tiktok-pink" />
      </div>
    ) : comments.length === 0 ? (
      <div className="flex flex-col items-center justify-center h-full text-center opacity-50 py-10">
        <p className="text-sm font-medium">Aucun commentaire pour l'instant.</p>
        <p className="text-xs">Soyez le premier à commenter !</p>
      </div>
    ) : (
      comments.map((comment) => (
        <div key={comment.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 group/comment">
          <Link href={`/@${comment.users?.username}`} className="shrink-0 active:scale-90 transition-transform">
            <img
              src={comment.users?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
              alt="avatar"
              className="w-8 h-8 rounded-full border border-white/10 object-cover shadow-sm shrink-0"
            />
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`/@${comment.users?.username}`} className="w-fit block">
              <span className="text-xs text-gray-400 font-bold mb-0.5 block hover:underline cursor-pointer">
                {comment.users?.username}
              </span>
            </Link>
            <p className="text-[13px] text-white/90 leading-relaxed break-words whitespace-pre-wrap">
              {comment.content}
            </p>
          </div>
        </div>
      ))
    )}
    <div ref={messagesEndRef} />
  </div>
)

const CommentInput = ({ 
  onSubmit, 
  value, 
  onChange, 
  isSubmitting, 
  avatarUrl, 
  isInline 
}: { 
  onSubmit: (e: React.FormEvent) => void, 
  value: string, 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, 
  isSubmitting: boolean, 
  avatarUrl: string | undefined, 
  isInline: boolean 
}) => (
  <form
    onSubmit={onSubmit}
    className={`shrink-0 p-4 border-t border-white/5 flex items-center gap-3 ${isInline ? 'bg-zinc-900/50' : 'bg-[#1a1a1a]'}`}
  >
    <img
      src={avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
      alt="my avatar"
      className="w-9 h-9 rounded-full object-cover shrink-0 border border-white/10 shadow-md"
    />
    <div className="flex-1 relative group">
      <input
        type="text"
        placeholder="Ajouter un commentaire..."
        value={value}
        onChange={onChange}
        className="w-full bg-white/5 group-hover:bg-white/10 transition-colors rounded-full pl-4 pr-10 py-2.5 text-[13px] text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-tiktok-pink border border-white/5"
      />
      <button
        type="submit"
        disabled={!value.trim() || isSubmitting}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-tiktok-pink disabled:opacity-30 hover:scale-110 active:scale-95 transition-all outline-none"
      >
        {isSubmitting ? (
           <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
           <Send className="w-4 h-4 fill-current" />
        )}
      </button>
    </div>
  </form>
)

export default function CommentSheet({ videoId, onClose, isInline = false }: CommentSheetProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const currentUser = useStore((s) => s.currentUser)
  const setShowAuthModal = useStore((s) => s.setShowAuthModal)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    let ignore = false
    const fetchComments = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('comments')
          .select(`*, users (username, avatar_url)`)
          .eq('video_id', videoId)
          .order('created_at', { ascending: true })
          .limit(50)
    
        if (!ignore && !error && data) {
          setComments(data as unknown as Comment[])
          setTimeout(() => scrollToBottom(), 100)
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }
  
    fetchComments()
    return () => { ignore = true }
  }, [videoId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = sanitizeText(newComment)
    if (!content.trim()) return

    if (!currentUser) {
      setShowAuthModal(true)
      return
    }

    setIsSubmitting(true)

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          video_id: videoId,
          user_id: currentUser.id,
          content,
        })
        .select(`*, users (username, avatar_url)`)
        .single()

      if (error) throw error

      if (data) {
        // ✅ Fix Stale State: use functional update
        setComments(prev => [...prev, data as unknown as Comment])
        setNewComment('')
        setTimeout(() => scrollToBottom(), 100)
      }
    } catch {
      toast.error('Erreur lors de l’envoi du commentaire')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isInline) {
    return (
      <div className="flex flex-col h-full bg-transparent overflow-hidden">
        <CommentList loading={loading} comments={comments} messagesEndRef={messagesEndRef} />
        <CommentInput 
          onSubmit={handleSubmit} 
          value={newComment} 
          onChange={(e) => setNewComment(e.target.value)} 
          isSubmitting={isSubmitting} 
          avatarUrl={currentUser?.avatar_url}
          isInline={isInline}
        />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[160] flex flex-col justify-end pointer-events-none">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 pointer-events-auto backdrop-blur-[2px]"
      />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative min-h-[60vh] max-h-[85vh] w-full max-w-[500px] mx-auto bg-[#121212] rounded-t-2xl flex flex-col pointer-events-auto shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/5 shrink-0">
          <div className="w-8" />
          <h3 className="text-sm font-black uppercase tracking-widest text-white/90">
            {comments.length > 0 ? `${comments.length} commentaires` : 'Commentaires'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/80 active:scale-90 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <CommentList loading={loading} comments={comments} messagesEndRef={messagesEndRef} />
        <CommentInput 
          onSubmit={handleSubmit} 
          value={newComment} 
          onChange={(e) => setNewComment(e.target.value)} 
          isSubmitting={isSubmitting} 
          avatarUrl={currentUser?.avatar_url}
          isInline={isInline}
        />
      </motion.div>
    </div>
  )
}
