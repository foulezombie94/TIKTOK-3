'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, CheckCircle, X, Loader2, Shield } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { validateVideoFile, validateMagicBytes, sanitizeText } from '@/lib/sanitize'

export default function UploadPage() {
  const router = useRouter()
  const currentUser = useStore(state => state.currentUser)
  const isAuthLoading = useStore(state => state.isAuthLoading)
  const setShowAuthModal = useStore(state => state.setShowAuthModal)

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [musicName, setMusicName] = useState('Son original')
  const [isPrivate, setIsPrivate] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isAuthLoading) return
    if (!currentUser) {
       toast.error('Connectez-vous pour uploader une vidéo.')
       setShowAuthModal(true)
       router.push('/')
    }
  }, [currentUser, isAuthLoading, router, setShowAuthModal])

  // Cleanup object URL to prevent memory leaks !
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      // Phase 4: Validation stricte via lib/sanitize
      const validation = validateVideoFile(selected)
      if (!validation.valid) {
        toast.error(validation.error || 'Fichier invalide')
        return
      }

      // Phase 4: Vérification des magic bytes (anti-falsification content-type)
      try {
        const headerBuffer = await selected.slice(0, 16).arrayBuffer()
        if (!validateMagicBytes(headerBuffer, selected.type)) {
          toast.error('Le fichier ne correspond pas au format déclaré. Tentative de falsification détectée.')
          return
        }
      } catch {
        toast.error('Impossible de valider le fichier.')
        return
      }

      setFile(selected)
      
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(selected))
    }
  }

  const handleUpload = async () => {
    if (!file || !currentUser) return

    setUploading(true)
    setProgress(10)

    try {
      const fileExt = file.name.split('.').pop()
      // Security: use native crypto instead of Math.random
      const fileName = `${crypto.randomUUID()}.${fileExt}`
      const filePath = `${currentUser.id}/${fileName}`

      setProgress(40)

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, file, { upsert: false })

      if (uploadError) throw uploadError

      setProgress(70)

      const { data: publicUrlData } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath)
      
      const videoUrl = publicUrlData.publicUrl

      setProgress(90)

      // Phase 4: Sanitize user inputs before DB insertion
      const { error: dbError } = await supabase
        .from('videos')
        .insert({
          user_id: currentUser.id,
          video_url: videoUrl,
          caption: sanitizeText(caption, 2000),
          music_name: sanitizeText(musicName, 100),
          is_private: isPrivate
        })

      if (dbError) throw dbError

      setProgress(100)
      toast.success('Vidéo publiée avec succès !')
      
      setTimeout(() => {
        router.push(`/profile/${currentUser.username}`)
      }, 1000)

    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l&apos;upload')
      setUploading(false)
      setProgress(0)
    }
  }

  if (isAuthLoading || !currentUser) return null

  return (
    <div className="h-[100dvh] w-full bg-black flex flex-col pt-14 pb-[80px] overflow-y-auto px-4 safe-area-bottom">
      <div className="flex items-center justify-between mb-6 pt-4">
        <h1 className="text-xl font-bold">Publier une vidéo</h1>
        <button onClick={() => router.back()} className="p-2 bg-white/10 rounded-full">
           <X className="w-5 h-5 text-white" />
        </button>
      </div>

      <div className="flex flex-col gap-6">
        {!previewUrl ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-[3/4] border-2 border-dashed border-zinc-700 rounded-xl bg-zinc-900/50 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"
          >
            <UploadCloud className="w-12 h-12 text-zinc-400" />
            <div className="text-center px-4">
              <p className="text-sm font-semibold mb-1">Sélectionner une vidéo</p>
              <p className="text-xs text-zinc-500">MP4 ou WebM, résolution 720x1280 recommandée</p>
              <p className="text-xs text-zinc-500 mt-2">Jusqu&apos;à 50 Mo</p>
            </div>
            <button className="mt-4 px-6 py-2 bg-tiktok-pink rounded-md font-semibold text-sm">
               Parcourir
            </button>
          </div>
        ) : (
          <div className="relative w-full aspect-[3/4] bg-zinc-900 rounded-xl overflow-hidden shadow-lg border border-zinc-800 shrink-0">
             <video 
               src={previewUrl} 
               className="w-full h-full object-cover" 
               controls 
               autoPlay 
               loop 
               muted 
             />
             {!uploading && (
               <button 
                 onClick={() => { setFile(null); setPreviewUrl(null) }}
                 className="absolute top-4 right-4 p-2 bg-black/60 rounded-full backdrop-blur-sm z-10"
               >
                 <X className="w-4 h-4 text-white" />
               </button>
             )}
          </div>
        )}

        <input
          type="file"
          accept="video/mp4,video/webm"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileSelect}
        />

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-semibold text-zinc-300 block mb-2">Description</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Décris ta vidéo avec des #hashtags"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-tiktok-pink min-h-[100px] resize-none"
              disabled={uploading}
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-zinc-300 block mb-2">Nom de la musique</label>
            <input
              type="text"
              value={musicName}
              onChange={(e) => setMusicName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-tiktok-pink"
              disabled={uploading}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-700 rounded-lg">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <Shield className="w-4 h-4 text-tiktok-pink" />
                Vidéo privée
              </span>
              <span className="text-xs text-zinc-500">Seul vous pourrez voir cette vidéo</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={isPrivate}
                onChange={() => setIsPrivate(!isPrivate)}
              />
              <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-tiktok-pink"></div>
            </label>
          </div>

          <div className="border-t border-zinc-800 pt-6 mt-2">
            <button
               onClick={handleUpload}
               disabled={!file || uploading}
               className="w-full bg-tiktok-pink text-white font-bold py-3.5 rounded-lg text-[15px] flex items-center justify-center gap-2 hover:bg-[#e0204d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
               {uploading ? (
                 <>
                   <Loader2 className="w-5 h-5 animate-spin" />
                   <span className="animate-pulse">Publication en cours... ({progress}%)</span>
                 </>
               ) : (
                 <>
                   <CheckCircle className="w-5 h-5" />
                   Publier
                 </>
               )}
            </button>
            
            {uploading && (
               <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-4 overflow-hidden">
                  <div className="upload-progress h-full" style={{ width: `${progress}%` }} />
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
