-- Correction des droits pour la table des favoris (bookmarks)
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- Nettoyage des anciennes politiques
DROP POLICY IF EXISTS "Users can create their own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can view their own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can delete their own bookmarks" ON public.bookmarks;

-- Création des politiques permettant l'enregistrement permanent
CREATE POLICY "Users can create their own bookmarks" 
ON public.bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own bookmarks" 
ON public.bookmarks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks" 
ON public.bookmarks FOR DELETE USING (auth.uid() = user_id);

-- Vérification des index pour la performance de l'onglet Profil
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON public.bookmarks(user_id);
