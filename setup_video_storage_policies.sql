-- ========================================================
-- 🛡️ SECURE STORAGE POLICIES (v5 - FINAL HARDENING)
-- Configuration: Folder Isolation, Native Limits & Strict RLS
-- ========================================================

-- 1. CONFIGURATION DU BUCKET (SI ABSENT)
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Application de la limite de taille de 50MB (52428800 bytes) directement sur le bucket
UPDATE storage.buckets
SET file_size_limit = 52428800 
WHERE id = 'videos';

-- 2. NETTOYAGE DES ANCIENNES POLITIQUES
DROP POLICY IF EXISTS "RLS_STORAGE_SELECT" ON storage.objects;
DROP POLICY IF EXISTS "RLS_STORAGE_INSERT" ON storage.objects;
DROP POLICY IF EXISTS "RLS_STORAGE_DELETE" ON storage.objects;
DROP POLICY IF EXISTS "RLS_STORAGE_UPDATE" ON storage.objects;

-- 3. NOUVELLES POLITIQUES DE SÉCURITÉ "HARDCORE"

-- A. LECTURE (SELECT)
-- Note: Lecture publique pour le streaming des vidéos.
CREATE POLICY "RLS_STORAGE_SELECT" ON storage.objects 
FOR SELECT USING (
  bucket_id = 'videos'
);

-- B. INSERTION (INSERT)
-- Règle : Uniquement les utilisateurs authentifiés.
-- Règle : Cloisonnement strict par dossier (videos/{user_id}/filename).
-- Règle : Extensions limitées via IN ().
CREATE POLICY "RLS_STORAGE_INSERT" ON storage.objects 
FOR INSERT WITH CHECK (
  bucket_id = 'videos' AND 
  auth.role() = 'authenticated' AND
  -- Sécurité : L'utilisateur doit uploader dans un dossier portant son propre user_id
  (storage.foldername(name))[1] = auth.uid()::text AND
  -- Utilisation d'un IN () plus propre pour les extensions
  (storage.extension(name) IN ('mp4', 'webm', 'mov'))
);

-- C. MISE À JOUR (UPDATE)
-- Règle : Autoriser l'écrasement de ses propres fichiers.
CREATE POLICY "RLS_STORAGE_UPDATE" ON storage.objects 
FOR UPDATE USING (
  bucket_id = 'videos' AND
  auth.role() = 'authenticated' AND
  auth.uid() = owner
);

-- D. SUPPRESSION (DELETE)
-- Règle : Uniquement le propriétaire du fichier ou un admin.
CREATE POLICY "RLS_STORAGE_DELETE" ON storage.objects 
FOR DELETE USING (
  bucket_id = 'videos' AND
  auth.role() = 'authenticated' AND
  (
    auth.uid() = owner OR 
    EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid())
  )
);

-- Finalisation
NOTIFY pgrst, 'reload schema';
