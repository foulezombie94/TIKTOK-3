-- ================================================================
-- 🔒 SECURITY FIX: PRIVILEGE ESCALATION VIA RLS (CRITIQUE)
-- ================================================================
-- PROBLÈME: La politique RLS "Users can update own security info"
-- permet à un utilisateur de modifier TOUTES les colonnes de sa
-- ligne (y compris role, status, ban_reason, etc.)
--
-- Ce script applique 2 couches de protection:
--   1. REVOKE column-level UPDATE (PostgreSQL natif)
--   2. Trigger BEFORE UPDATE (défense en profondeur)
--
-- ⚠️  EXÉCUTER DANS LE SQL EDITOR DE SUPABASE (Dashboard)
-- ================================================================

-- ================================================================
-- COUCHE 1 : REVOKE des colonnes sensibles
-- ================================================================
-- Le rôle 'authenticated' ne pourra PLUS modifier ces colonnes,
-- même si la politique RLS autorise la ligne entière.
-- ================================================================
REVOKE UPDATE (role) ON public.users FROM authenticated;
REVOKE UPDATE (status) ON public.users FROM authenticated;
REVOKE UPDATE (ban_reason) ON public.users FROM authenticated;
REVOKE UPDATE (banned_until) ON public.users FROM authenticated;
REVOKE UPDATE (hardware_id) ON public.users FROM authenticated;
REVOKE UPDATE (last_ip) ON public.users FROM authenticated;
REVOKE UPDATE (created_at) ON public.users FROM authenticated;

-- Le service_role (API admin) garde tous les droits
GRANT UPDATE ON public.users TO service_role;

-- ================================================================
-- COUCHE 2 : Trigger BEFORE UPDATE (défense en profondeur)
-- ================================================================
-- Même si un attaquant contourne les REVOKE (impossible en théorie,
-- mais sécurité = ceinture + bretelles), ce trigger écrase
-- silencieusement les valeurs sensibles avec les anciennes.
-- ================================================================
CREATE OR REPLACE FUNCTION public.protect_user_sensitive_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Le service_role (API admin) peut tout modifier
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Pour tous les autres rôles : verrouiller les colonnes critiques
  NEW.role := OLD.role;
  NEW.status := OLD.status;
  NEW.ban_reason := OLD.ban_reason;
  NEW.banned_until := OLD.banned_until;
  NEW.created_at := OLD.created_at;

  -- hardware_id et last_ip : autorisés UNIQUEMENT si la valeur
  -- actuelle est NULL (premier enregistrement de l'appareil)
  IF OLD.hardware_id IS NOT NULL THEN
    NEW.hardware_id := OLD.hardware_id;
  END IF;
  IF OLD.last_ip IS NOT NULL THEN
    NEW.last_ip := OLD.last_ip;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS protect_user_fields ON public.users;

-- Créer le trigger
CREATE TRIGGER protect_user_fields
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_sensitive_columns();

-- ================================================================
-- VÉRIFICATION : Tester que le fix fonctionne
-- ================================================================
-- Exécuter ceci APRÈS le script principal pour vérifier :
--
-- 1. Se connecter en tant qu'utilisateur normal
-- 2. Essayer : UPDATE users SET role = 'admin' WHERE id = auth.uid();
--    → Résultat attendu : ERREUR "permission denied for column role"
--
-- 3. Depuis le Dashboard Admin (service_role) :
--    UPDATE users SET role = 'admin' WHERE id = '...';
--    → Résultat attendu : SUCCÈS ✅
-- ================================================================

-- Recharger le cache PostgREST
NOTIFY pgrst, 'reload schema';
