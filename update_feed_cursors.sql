-- ==============================================
-- OPTIMISATION PRODUCTION : PAGINATION PAR CURSEUR
-- ==============================================

-- 1. Indexation composite (Lookup O(1) pour les états utilisateur)
CREATE INDEX IF NOT EXISTS idx_likes_composite_id ON public.likes (user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_composite_id ON public.bookmarks (user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_follows_composite_id ON public.follows (follower_id, following_id);

-- 2. Fonction RPC par Curseur (Plus performant que OFFSET)
-- Écrase la version offset pour forcer la migration
CREATE OR REPLACE FUNCTION get_fyp_videos(
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
  user_has_liked boolean, user_has_saved boolean, user_is_following boolean
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
    -- États utilisateur
    EXISTS(SELECT 1 FROM likes l WHERE l.video_id = v.id AND l.user_id = p_user_id) AS user_has_liked,
    EXISTS(SELECT 1 FROM bookmarks b WHERE b.video_id = v.id AND b.user_id = p_user_id) AS user_has_saved,
    EXISTS(SELECT 1 FROM follows f WHERE f.following_id = v.user_id AND f.follower_id = p_user_id) AS user_is_following
  FROM videos v
  JOIN users u ON u.id = v.user_id
  WHERE
    -- Logique du curseur (pagination déterministe)
    (p_cursor IS NULL OR (v.created_at, v.id) < (p_cursor, p_cursor_id))
  ORDER BY v.created_at DESC, v.id DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

ANALYZE public.videos;
ANALYZE public.bookmarks;
ANALYZE public.likes;
