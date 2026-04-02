-- ================================================================
-- 🛡️ SECURITY HARDENING V6: EXPERT FAIL-SAFE (SOC + Real-World IP)
-- ================================================================
-- Ce script implémente les mesures de sécurité les plus avancées :
-- 1. Logging non-bloquant (Fail-safe) avec BEGIN...EXCEPTION.
-- 2. Délégation RLS granulaire (JWT-Admin) sans service_role.
-- 3. Forensics IP réelle (JWT preferred, inet fallback).
-- 4. Isolation de sécurité totale (search_path, Double role check).
-- ================================================================

-- 0. INFRASTRUCTURE D'AUDIT (Expert Delegation)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.security_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,          -- L'attaquant
  target_id uuid,        -- La victime
  ip TEXT,               -- IP Forensique (TEXT pour supporter les proxys/JWT)
  event text,            -- Incident type
  created_at timestamptz DEFAULT now()
);

-- Indexation pour recherche SOC rapide
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON public.security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON public.security_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_security_logs_event ON public.security_logs(event);

-- [RLS DELEGATION] : Autorise les admins à voir les logs via leur JWT
-- Cela évite d'utiliser le service_role pour le dashboard admin.
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view logs" ON public.security_logs;
CREATE POLICY "Admins can view logs" 
  ON public.security_logs 
  FOR SELECT 
  USING (
    (auth.jwt() ->> 'role' = 'admin') OR 
    (current_user = 'service_role')
  );

-- 1. PERFORMANCE & SCALING : INDEX USERS
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_users_id ON public.users(id);

-- 2. ACTIVATION & COUVERTURE RLS (Row Level Security)
-- ================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Nettoyage complet
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.users;

-- CRUD Lifecycle Complete
CREATE POLICY "Public profiles are viewable by everyone" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON public.users FOR DELETE USING (auth.uid() = id);


-- 3. TRIGGER DE PROTECTION (Fail-Safe & Real IP - EXPERT MODE)
-- ================================================================
CREATE OR REPLACE FUNCTION public.protect_sensitive_user_data() 
RETURNS trigger AS $$
DECLARE
  v_client_ip TEXT;
BEGIN
  -- 🛡️ DOUBLE VÉRIFICATION DE SÉCURITÉ CONTEXTUELLE
  IF current_user != 'service_role' AND auth.role() != 'service_role' THEN
  
    -- 🛑 DÉTECTION : Modification de champs sensibles
    IF (NEW.role IS DISTINCT FROM OLD.role) OR 
       (NEW.status IS DISTINCT FROM OLD.status) OR
       (NEW.followers_count IS DISTINCT FROM OLD.followers_count) OR
       (NEW.ban_reason IS DISTINCT FROM OLD.ban_reason) OR
       (NEW.banned_until IS DISTINCT FROM OLD.banned_until)
    THEN
        -- 🕵️ FORENSIC IP : Tenter de récupérer l'IP réelle du JWT (Proxy-safe)
        -- Fallback sur inet_client_addr() si absent.
        v_client_ip := COALESCE(auth.jwt() ->> 'ip', inet_client_addr()::TEXT);

        -- 🏢 FAIL-SAFE LOGGING : L'insertion ne doit JAMAIS faire échouer le blocage
        BEGIN
          INSERT INTO public.security_logs (user_id, target_id, ip, event)
          VALUES (auth.uid(), OLD.id, v_client_ip, 'privilege_escalation_attempt');
        EXCEPTION WHEN OTHERS THEN
          -- On ignore l'erreur d'insertion pour garantir que l'exception de blocage ci-dessous est levée.
          RAISE WARNING 'Failed to log security incident: %', SQLERRM;
        END;

        -- 📝 SYSTEM LOG : Visibilité immédiate terminal
        RAISE LOG 'SECURITY ALERT: Privilege escalation attempt by UID %, IP %', auth.uid(), v_client_ip;
        
        -- 💥 BLOCK : Rejet de la transaction
        RAISE EXCEPTION 'Unauthorized modification of sensitive fields (Access Denied)';
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public; -- 🔥 Prévention Injection Search Path

-- Activation
DROP TRIGGER IF EXISTS enforce_user_data_protection ON public.users;
CREATE TRIGGER enforce_user_data_protection
  BEFORE UPDATE ON public.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.protect_sensitive_user_data();


-- 4. TRIGGER DE SYNCHRONISATION JWT (Optimisé)
-- ================================================================
CREATE OR REPLACE FUNCTION public.sync_user_to_auth_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- IS DISTINCT FROM : Économise les IOPS et évite les boucles infinies
  IF (OLD.role IS DISTINCT FROM NEW.role) OR (OLD.status IS DISTINCT FROM NEW.status) THEN
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
  END IF;
  
  RETURN NEW;
END;
$$ 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public;

-- Activation
DROP TRIGGER IF EXISTS trg_sync_user_metadata ON public.users;
CREATE TRIGGER trg_sync_user_metadata
  AFTER UPDATE OF role, status ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_to_auth_metadata();

-- 5. HARMONISATION INITIALE
-- ================================================================
DO $$
BEGIN
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

-- Reload Cache
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- 🧹 MAINTENANCE DES LOGS (Enterprise Cleanup)
-- ================================================================
-- À exécuter ou à mettre en cron job pour éviter l'explosion de la table.
-- Exemple : Purge des logs de plus de 30 jours.
-- DELETE FROM public.security_logs WHERE created_at < now() - interval '30 days';

-- [NOTE FINALE]
-- Votre système est désormais protégé par :
-- 1. Un Rate Limiter Redis (Middleware)
-- 2. Un Trigger de protection Hardcore (Database)
-- 3. Un Audit Log Forensic (security_logs)
-- 4. Une isolation search_path (Postgres)
