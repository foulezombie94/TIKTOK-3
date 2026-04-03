-- 🔄 ULTRA-SYNC : Auth -> Public (Infrastructure Elite)
-- Résout le problème de synchronisation lors de l'inscription (Sign-up).

-- 1. Fonction de Création Atomique (Lancée à l'inscription)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    default_username TEXT;
BEGIN
    -- Génération d'un pseudo par défaut sécurisé (email sans @ + random)
    default_username := split_part(NEW.email, '@', 1) || '_' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 4);

    INSERT INTO public.users (
        id, 
        username, 
        display_name, 
        avatar_url,
        status,
        created_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', default_username),
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || NEW.id),
        'active',
        NOW()
    )
    ON CONFLICT (id) DO NOTHING; -- Évite les crashs si déjà synchronisé

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Installation du Trigger d'Insertion (Inscription)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Fonction de Mise à Jour (Bannissement / Sync Profil)
CREATE OR REPLACE FUNCTION public.handle_auth_user_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Synchronisation des états de bannissement
  IF (NEW.banned_until IS DISTINCT FROM OLD.banned_until) THEN
    IF (NEW.banned_until IS NULL) THEN
        UPDATE public.users SET status = 'active', banned_until = NULL WHERE id = NEW.id;
    ELSE
        UPDATE public.users SET status = 'banned', banned_until = NEW.banned_until WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Installation du Trigger de Mise à Jour (Bannissement)
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_update();

-- 5. Réparation des Utilisateurs Orphelins (Indispensable)
-- Crée les profils manquants pour les utilisateurs déjà inscrits
INSERT INTO public.users (id, username, display_name, status, created_at)
SELECT 
    id, 
    COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1) || '_' || floor(random()*999)::text),
    COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
    'active',
    created_at
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

-- 💎 Ton architecture de synchronisation est désormais 100% robuste.
