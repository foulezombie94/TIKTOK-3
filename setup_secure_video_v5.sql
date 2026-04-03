-- ========================================================
-- 🛡️ SECURE VIDEO ARCHITECTURE (v5 - FINAL HARDENING)
-- Configuration: Slugs, Privacy Control & Strict RLS
-- ========================================================

-- 0. PRÉREQUIS : Extension pour l'aléatoire
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. MODIFICATION DE LA TABLE public.videos
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS slug text UNIQUE,
ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

-- Indexation pour recherche rapide par slug (URLs de partage)
CREATE INDEX IF NOT EXISTS idx_videos_slug ON public.videos (slug);

-- 2. SYSTÈME DE GÉNÉRATION AUTOMATIQUE DE SLUG (ID COURT)
-- Fonction interne de base (6 caractères alphanumériques)
CREATE OR REPLACE FUNCTION generate_short_slug() RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Fonction pour garantir l'unicité
CREATE OR REPLACE FUNCTION generate_unique_video_slug() RETURNS TRIGGER AS $$
DECLARE
  v_new_slug TEXT;
  v_exists BOOLEAN;
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    RETURN NEW;
  END IF;

  LOOP
    v_new_slug := generate_short_slug();
    SELECT EXISTS (SELECT 1 FROM public.videos WHERE slug = v_new_slug) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  NEW.slug := v_new_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Installation du Trigger de slugging
DROP TRIGGER IF EXISTS trg_auto_slug_videos ON public.videos;
CREATE TRIGGER trg_auto_slug_videos
BEFORE INSERT ON public.videos
FOR EACH ROW EXECUTE FUNCTION generate_unique_video_slug();

-- 3. MISE À JOUR DE LA FONCTION FYP (VERSION 3)
-- On inclut le 'slug' pour les liens de partage dans le feed
CREATE OR REPLACE FUNCTION get_fyp_videos_v3(
  p_user_id uuid,
  p_cursor timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  id uuid, user_id uuid, video_url text, thumbnail_url text,
  caption text, music_name text, views_count bigint,
  created_at timestamptz,
  username text, display_name text, avatar_url text,
  likes_count bigint, comments_count bigint, bookmarks_count bigint,
  user_has_liked boolean, user_has_saved boolean, user_is_following boolean,
  slug text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id, v.user_id, v.video_url, v.thumbnail_url,
    v.caption, v.music_name, v.views_count, v.created_at,
    u.username, u.display_name, u.avatar_url,
    v.likes_count,
    v.comments_count,
    v.bookmarks_count,
    EXISTS(SELECT 1 FROM likes l WHERE l.video_id = v.id AND l.user_id = p_user_id) AS user_has_liked,
    EXISTS(SELECT 1 FROM bookmarks b WHERE b.video_id = v.id AND b.user_id = p_user_id) AS user_has_saved,
    EXISTS(SELECT 1 FROM follows f WHERE f.following_id = v.user_id AND f.follower_id = p_user_id) AS user_is_following,
    v.slug
  FROM videos v
  JOIN users u ON u.id = v.user_id
  WHERE
    (is_private = false) AND -- Filtre de sécurité global pour le FYP
    (p_cursor IS NULL OR (v.created_at, v.id) < (p_cursor, p_cursor_id))
  ORDER BY v.created_at DESC, v.id DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 4. ROW LEVEL SECURITY (RLS) - CONFIGURATION FINALE
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "RLS_VIDEOS_SELECT" ON public.videos;
CREATE POLICY "RLS_VIDEOS_SELECT" ON public.videos 
FOR SELECT USING (
  (is_private = false) OR 
  (auth.uid() = user_id) OR
  (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()))
);

DROP POLICY IF EXISTS "RLS_VIDEOS_INSERT" ON public.videos;
CREATE POLICY "RLS_VIDEOS_INSERT" ON public.videos 
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND 
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "RLS_VIDEOS_UPDATE" ON public.videos;
CREATE POLICY "RLS_VIDEOS_UPDATE" ON public.videos 
FOR UPDATE USING (
  auth.uid() = user_id
) WITH CHECK (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "RLS_VIDEOS_DELETE" ON public.videos;
CREATE POLICY "RLS_VIDEOS_DELETE" ON public.videos 
FOR DELETE USING (
  auth.uid() = user_id OR
  (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()))
);

-- 5. BACKFILL SÉCURISÉ : Générer des slugs sans risque de collision
DO $$
DECLARE
    v_record RECORD;
    v_new_slug TEXT;
    v_exists BOOLEAN;
BEGIN
    FOR v_record IN SELECT id FROM public.videos WHERE slug IS NULL LOOP
        LOOP
            v_new_slug := generate_short_slug();
            SELECT EXISTS (SELECT 1 FROM public.videos WHERE slug = v_new_slug) INTO v_exists;
            EXIT WHEN NOT v_exists;
        END LOOP;
        UPDATE public.videos SET slug = v_new_slug WHERE id = v_record.id;
    END LOOP;
END $$;

-- Finalisation
ANALYZE public.videos;
NOTIFY pgrst, 'reload schema';
