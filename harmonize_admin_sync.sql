-- ========================================================
-- 🔄 HARMONISATION DU RÔLE ADMIN (Source de Vérité unique)
-- Assure que le rôle défini dans auth.users (Metadata) 
-- est toujours synchronisé avec public.users.
-- ========================================================

-- 1. Fonction de synchronisation améliorée
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
BEGIN
  -- Extraction du rôle depuis raw_app_meta_data (Source de vérité Auth)
  -- Si absent, défaut à 'user'
  v_role := COALESCE(NEW.raw_app_meta_data->>'role', 'user');

  -- Insertion ou Mise à jour dans la table publique
  INSERT INTO public.users (id, username, display_name, avatar_url, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'User ' || substr(NEW.id::text, 1, 8)),
    NEW.raw_user_meta_data->>'avatar_url',
    v_role,
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET 
    role = v_role,
    username = COALESCE(NEW.raw_user_meta_data->>'username', public.users.username);

  -- Si c'est un admin, on s'assure qu'il est dans admin_roles
  IF v_role = 'admin' THEN
    INSERT INTO public.admin_roles (user_id, level_access)
    VALUES (NEW.id, 'moderator')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Recréation du Trigger de Création
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Trigger supplémentaire pour la mise à jour du rôle
DROP TRIGGER IF EXISTS on_auth_user_role_update ON auth.users;
CREATE TRIGGER on_auth_user_role_update
  AFTER UPDATE OF raw_app_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Synchronisation initiale pour les utilisateurs existants
DO $$
BEGIN
  UPDATE public.users u
  SET role = COALESCE(a.raw_app_meta_data->>'role', 'user')
  FROM auth.users a
  WHERE u.id = a.id;
END $$;
