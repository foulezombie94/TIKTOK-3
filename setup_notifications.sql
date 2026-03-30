-- Script de mise en place de l'Architecture de Notifications (Trigger SQL)
-- Copiez et collez tout ce script dans l'éditeur SQL de votre Dashboard Supabase et cliquez sur Run.

-- 1. Création de la table notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE, -- Celui qui reçoit (le créateur)
  actor_id uuid REFERENCES public.users(id) ON DELETE CASCADE, -- Celui qui fait l'action
  video_id uuid REFERENCES public.videos(id) ON DELETE CASCADE, -- La vidéo concernée (optionnel)
  type text NOT NULL, -- 'like', 'comment', 'follow', 'bookmark'
  text text, -- contenu du commentaire si type = 'comment'
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Index pour accélérer la lecture
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- 2. Fonction et Trigger pour les Likes
CREATE OR REPLACE FUNCTION public.handle_new_like()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Récupérer le propriétaire de la vidéo
  SELECT user_id INTO v_owner_id FROM public.videos WHERE id = NEW.video_id;
  
  -- Ne pas envoyer de notification à soi-même (Security Rule)
  IF v_owner_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, video_id, type)
    VALUES (v_owner_id, NEW.user_id, NEW.video_id, 'like');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_created ON public.likes;
CREATE TRIGGER on_like_created
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_like();

-- 3. Fonction et Trigger pour les Commentaires
CREATE OR REPLACE FUNCTION public.handle_new_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT user_id INTO v_owner_id FROM public.videos WHERE id = NEW.video_id;
  
  IF v_owner_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, video_id, type, text)
    VALUES (v_owner_id, NEW.user_id, NEW.video_id, 'comment', NEW.content);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_created ON public.comments;
CREATE TRIGGER on_comment_created
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_comment();

-- 4. Fonction et Trigger pour les Follows
CREATE OR REPLACE FUNCTION public.handle_new_follow()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.following_id != NEW.follower_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type)
    VALUES (NEW.following_id, NEW.follower_id, 'follow');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_follow_created ON public.follows;
CREATE TRIGGER on_follow_created
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_follow();

-- 5. Fonction et Trigger pour les Bookmarks
CREATE OR REPLACE FUNCTION public.handle_new_bookmark()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT user_id INTO v_owner_id FROM public.videos WHERE id = NEW.video_id;
  
  IF v_owner_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, video_id, type)
    VALUES (v_owner_id, NEW.user_id, NEW.video_id, 'bookmark');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_bookmark_created ON public.bookmarks;
CREATE TRIGGER on_bookmark_created
  AFTER INSERT ON public.bookmarks
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_bookmark();

-- 6. Activer le mode "Realtime" (Indispensable pour NotifProvider)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; -- (ignoré ou commenté car s'il y a l'erreur 42710, c'est déjà activé !)

-- 7. Nettoyage lors des annulations (Unlike, Unfollow, Unbookmark, Uncomment)

-- Unlike
CREATE OR REPLACE FUNCTION public.handle_delete_like()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.notifications 
  WHERE type = 'like' AND actor_id = OLD.user_id AND video_id = OLD.video_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_deleted ON public.likes;
CREATE TRIGGER on_like_deleted
  AFTER DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_delete_like();

-- Uncomment
CREATE OR REPLACE FUNCTION public.handle_delete_comment()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.notifications 
  WHERE type = 'comment' AND actor_id = OLD.user_id AND video_id = OLD.video_id AND text = OLD.content;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_deleted ON public.comments;
CREATE TRIGGER on_comment_deleted
  AFTER DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_delete_comment();

-- Unfollow
CREATE OR REPLACE FUNCTION public.handle_delete_follow()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.notifications 
  WHERE type = 'follow' AND actor_id = OLD.follower_id AND user_id = OLD.following_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_follow_deleted ON public.follows;
CREATE TRIGGER on_follow_deleted
  AFTER DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.handle_delete_follow();

-- Unbookmark
CREATE OR REPLACE FUNCTION public.handle_delete_bookmark()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.notifications 
  WHERE type = 'bookmark' AND actor_id = OLD.user_id AND video_id = OLD.video_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_bookmark_deleted ON public.bookmarks;
CREATE TRIGGER on_bookmark_deleted
  AFTER DELETE ON public.bookmarks
  FOR EACH ROW EXECUTE FUNCTION public.handle_delete_bookmark();

-- 8. Sécurisation de la table (Row Level Security)

-- Activer le RLS sur la table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Créer la politique : Un utilisateur ne peut LIRE que ses propres notifications
DROP POLICY IF EXISTS "Les utilisateurs peuvent voir leurs propres notifications" ON public.notifications;
CREATE POLICY "Les utilisateurs peuvent voir leurs propres notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

-- Créer la politique : Un utilisateur ne peut MODIFIER (ex: marquer comme lu) que ses propres notifications
DROP POLICY IF EXISTS "Les utilisateurs peuvent mettre à jour leurs propres notifications" ON public.notifications;
CREATE POLICY "Les utilisateurs peuvent mettre à jour leurs propres notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Créer la politique : Un utilisateur ne peut SUPPRIMER que ses propres notifications
DROP POLICY IF EXISTS "Les utilisateurs peuvent supprimer leurs propres notifications" ON public.notifications;
CREATE POLICY "Les utilisateurs peuvent supprimer leurs propres notifications" 
ON public.notifications 
FOR DELETE 
USING (auth.uid() = user_id);
