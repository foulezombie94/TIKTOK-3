'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Send, Loader2 } from 'lucide-react'
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
}

export default function CommentSheet({ videoId, onClose }: CommentSheetProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const currentUser = useStore((s) => s.currentUser)
  const setShowAuthModal = useStore((s) => s.setShowAuthModal)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchComments = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('comments')
        .select(`*, users (username, avatar_url)`)
        .eq('video_id', videoId)
        .order('created_at', { ascending: true })
        .limit(30) // Anti Out of Memory
  
      if (!error && data) {
        setComments(data as unknown as Comment[])
        setTimeout(() => scrollToBottom(), 100)
      }
      setLoading(false)
    }
  
    fetchComments()
  }, [videoId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

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
          content: sanitizeText(newComment),
        })
        .select(`*, users (username, avatar_url)`)
        .single()

      if (error) throw error

      if (data) {
        setComments([...comments, data as unknown as Comment])
        setNewComment('')
        setTimeout(() => scrollToBottom(), 100)
      }
    } catch {
      toast.error('Erreur lors de l&apos;envoi du commentaire')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[160] flex flex-col justify-end pointer-events-none">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 pointer-events-auto"
      />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative min-h-[60vh] max-h-[80vh] w-full max-w-[500px] mx-auto bg-[#1a1a1a] rounded-t-2xl flex flex-col pointer-events-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <h3 className="text-sm font-semibold flex-1 text-center">
            {comments.length > 0 ? `${comments.length} commentaires` : 'Commentaires'}
          </h3>
          <button
            onClick={onClose}
            className="absolute right-4 p-1 rounded-full bg-white/10 text-white/80 active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide flex flex-col gap-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-tiktok-pink" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
              <p className="text-sm">Aucun commentaire pour l&apos;instant.</p>
              <p className="text-xs">Soyez le premier à commenter !</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <img
                  src={comment.users?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt="avatar"
                  className="w-8 h-8 rounded-full border border-white/10 object-cover"
                />
                <div className="flex-1">
                  <span className="text-xs text-gray-400 font-semibold mb-0.5 block">
                    {comment.users?.username}
                  </span>
                  <p className="text-sm text-white/90 leading-snug break-words">
                    {comment.content}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form
          onSubmit={handleSubmit}
          className="shrink-0 p-3 bg-[#1a1a1a] border-t border-white/10 flex items-center gap-2"
        >
          <img
            src={currentUser?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
            alt="my avatar"
            className="w-9 h-9 rounded-full object-cover shrink-0"
          />
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Ajouter un commentaire..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full bg-[#333] rounded-full pl-4 pr-10 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-tiktok-pink"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-tiktok-pink disabled:opacity-50"
            >
              {isSubmitting ? (
                 <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                 <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
