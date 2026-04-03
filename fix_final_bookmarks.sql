-- ==============================================
-- SCRIPT FINAL : CORRECTION PERSISTANCE FAVORIS
-- ==============================================

-- 1. Sécurité de la table
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- 2. Nettoyage et création des politiques (ALL permet INSERT/SELECT/DELETE)
DROP POLICY IF EXISTS "Public bookmarks access" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can manage their own bookmarks" ON public.bookmarks;

CREATE POLICY "Users can manage their own bookmarks" 
ON public.bookmarks FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Indexation pour la jointure avec videos
-- Indispensable pour la requête .select('*, video:video_id(*)')
CREATE INDEX IF NOT EXISTS idx_bookmarks_composite ON public.bookmarks (user_id, video_id);

-- 4. Vérification de la relation vers videos
-- On s'assure que video_id pointe bien vers videos(id)
ALTER TABLE public.bookmarks 
DROP CONSTRAINT IF EXISTS bookmarks_video_id_fkey,
ADD CONSTRAINT bookmarks_video_id_fkey 
FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE;

-- 5. Backfill des compteurs (au cas où)
UPDATE public.videos v SET 
  bookmarks_count = (SELECT COUNT(*) FROM public.bookmarks b WHERE b.video_id = v.id);

ANALYZE public.bookmarks;
ANALYZE public.videos;
