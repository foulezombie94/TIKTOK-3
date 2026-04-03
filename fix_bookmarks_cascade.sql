-- ==============================================
-- FIX : INTÉGRITÉ RÉFÉRENTIELLE (CASCADE)
-- ==============================================

-- On s'assure que si une vidéo est supprimée, ses favoris disparaissent
-- Cela évite les "null videos" dans l'onglet favoris du profil

ALTER TABLE public.bookmarks
DROP CONSTRAINT IF EXISTS bookmarks_video_id_fkey;

ALTER TABLE public.bookmarks
ADD CONSTRAINT bookmarks_video_id_fkey
FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE;

-- Optionnel: Idem pour l'utilisateur
ALTER TABLE public.bookmarks
DROP CONSTRAINT IF EXISTS bookmarks_user_id_fkey;

ALTER TABLE public.bookmarks
ADD CONSTRAINT bookmarks_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ANALYZE public.bookmarks;
