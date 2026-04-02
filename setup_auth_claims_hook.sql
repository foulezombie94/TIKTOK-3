-- ================================================================
-- 🚀 PRODUCTION PERFORMANCE FIX: JWT CUSTOM CLAIMS
-- ================================================================
-- Ce script permet de supprimer 100% des appels DB dans le Middleware
-- en injectant 'role' et 'status' directement dans le JWT.
-- ================================================================

-- 1. TRIGGER DE SYNCHRONISATION (Sûr & Automatique)
-- Met à jour auth.users.raw_app_meta_data dès que public.users change.
-- Supabase inclut automatiquement raw_app_meta_data dans le JWT 'app_metadata'.
-- ================================================================
CREATE OR REPLACE FUNCTION public.sync_user_to_auth_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Synchroniser status, role et is_admin dans le JWT
  UPDATE auth.users
  SET raw_app_meta_data = 
    jsonb_set(
      jsonb_set(
        COALESCE(raw_app_meta_data, '{}'::jsonb),
        '{role}', to_jsonb(COALESCE(NEW.role, 'user'))
      ),
      '{status}', to_jsonb(COALESCE(NEW.status, 'active'))
    )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS trg_sync_user_metadata ON public.users;

-- Activer le trigger sur UPDATE de role ou status
CREATE TRIGGER trg_sync_user_metadata
  AFTER UPDATE OF role, status ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_to_auth_metadata();

-- 2. INITIALISATION (Pour les utilisateurs existants)
-- ================================================================
DO $$
BEGIN
  -- Applique les claims à tous les utilisateurs actuels
  UPDATE auth.users au
  SET raw_app_meta_data = 
    jsonb_set(
      jsonb_set(
        COALESCE(au.raw_app_meta_data, '{}'::jsonb),
        '{role}', to_jsonb(COALESCE(pu.role, 'user'))
      ),
      '{status}', to_jsonb(COALESCE(pu.status, 'active'))
    )
  FROM public.users pu
  WHERE au.id = pu.id;
END $$;

-- 3. VÉRIFICATION
-- ================================================================
-- Une fois exécuté, le JWT contiendra :
-- {
--   "app_metadata": { "role": "admin", "status": "active", ... }
-- }
-- ================================================================

-- Recharger le cache
NOTIFY pgrst, 'reload schema';
