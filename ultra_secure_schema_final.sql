-- ========================================================
-- 🛡️ ULTRA SECURE SCHEMA : CONSOLIDATION FINALE (v1)
-- Projets: TikTok Clone & TikTok Admin
-- ========================================================

-- 0. PRÉREQUIS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. STABILISATION DU SCHÉMA USERS
-- Assure la présence des colonnes critiques pour le middleware et l'admin
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user',
ADD COLUMN IF NOT EXISTS banned_until timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ban_reason text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hardware_id text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_ip text DEFAULT NULL;

-- Indexation pour performances Dashboard (Metrics)
CREATE INDEX IF NOT EXISTS idx_users_role_final ON public.users (role);
CREATE INDEX IF NOT EXISTS idx_users_status_final ON public.users (status);
CREATE INDEX IF NOT EXISTS idx_users_hardware_id ON public.users (hardware_id);

-- 2. DÉPLOIEMENT DU SYSTÈME D'AUDIT
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  metadata jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- 3. TRIGGERS DE SYNCHRONISATION SOPHISTIQUÉS (Source de vérité: Auth)

-- Fonction de synchronisation lors de la création d'un utilisateur
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
BEGIN
  v_role := COALESCE(NEW.raw_app_meta_data->>'role', 'user');

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
    status = 'active',
    username = COALESCE(NEW.raw_user_meta_data->>'username', public.users.username);

  -- Log Audit pour création
  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (NEW.id, 'user_created', 'user', NEW.id::text, jsonb_build_object('role', v_role));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fonction de synchronisation lors de la mise à jour (Bannissement & Rôles)
CREATE OR REPLACE FUNCTION public.handle_auth_user_update()
RETURNS TRIGGER AS $$
DECLARE
  v_old_role text;
  v_new_role text;
BEGIN
  -- 1. Sync Statut de Bannissement
  IF (NEW.banned_until IS NULL) THEN
    UPDATE public.users SET status = 'active', banned_until = NULL, ban_reason = NULL WHERE id = NEW.id;
  ELSE
    UPDATE public.users SET status = 'banned', banned_until = NEW.banned_until WHERE id = NEW.id;
  END IF;

  -- 2. Sync Rôle (si présent dans metadata)
  v_new_role := NEW.raw_app_meta_data->>'role';
  IF (v_new_role IS NOT NULL) THEN
    UPDATE public.users SET role = v_new_role WHERE id = NEW.id;
  END IF;

  -- 3. Audit Log automatique
  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    NEW.id, 
    'auth_sync_update', 
    'user', 
    NEW.id::text, 
    jsonb_build_object(
      'banned_until', NEW.banned_until,
      'role', v_new_role
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Installation/Refresh des Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF banned_until, raw_app_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_update();

-- 4. FONCTION SEND_GIFT ULTRA SÉCURISÉE (Anti-Deadlock & Audit)

CREATE OR REPLACE FUNCTION send_gift(p_sender_id uuid, p_receiver_id uuid, p_amount int, p_video_id uuid)
RETURNS boolean AS $$
DECLARE
  v_sender_balance int;
  v_first_id uuid;
  v_second_id uuid;
BEGIN
  -- Sécurité : Seule l'identité réelle peut envoyer (sauf si appelé par admin via service_role)
  IF (p_sender_id != auth.uid() AND auth.role() != 'service_role') THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  -- Anti-Congestion : Timeout de verrouillage pour éviter de bloquer la DB
  SET LOCAL lock_timeout = '3s';

  -- ANTI-DEADLOCK : Toujours verrouiller dans le même ordre (plus petit ID en premier)
  IF p_sender_id < p_receiver_id THEN
    v_first_id := p_sender_id;
    v_second_id := p_receiver_id;
  ELSE
    v_first_id := p_receiver_id;
    v_second_id := p_sender_id;
  END IF;

  -- 1. Initialisation & Verrouillage ordonné
  INSERT INTO public.wallets (user_id, balance) VALUES (v_first_id, 0) ON CONFLICT DO NOTHING;
  INSERT INTO public.wallets (user_id, balance) VALUES (v_second_id, 0) ON CONFLICT DO NOTHING;

  PERFORM balance FROM public.wallets WHERE user_id = v_first_id FOR UPDATE;
  PERFORM balance FROM public.wallets WHERE user_id = v_second_id FOR UPDATE;

  -- 2. Vérification Solde Envoyeur
  SELECT balance INTO v_sender_balance FROM public.wallets WHERE user_id = p_sender_id;
  IF v_sender_balance IS NULL OR v_sender_balance < p_amount THEN
    RAISE EXCEPTION 'Solde insuffisant';
  END IF;

  -- 3. Exécution de la Transaction
  UPDATE public.wallets SET balance = balance - p_amount WHERE user_id = p_sender_id;
  UPDATE public.wallets SET balance = balance + p_amount WHERE user_id = p_receiver_id;

  -- 4. Traçabilité Double (Transactions + Audit)
  INSERT INTO public.transactions (sender_id, receiver_id, amount, type, video_id)
  VALUES (p_sender_id, p_receiver_id, p_amount, 'gift', p_video_id);

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    p_sender_id, 
    'gift_sent', 
    'wallet', 
    p_sender_id::text, 
    jsonb_build_object('receiver', p_receiver_id, 'amount', p_amount, 'video', p_video_id)
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Finalisation
ANALYZE public.users;
ANALYZE public.wallets;
NOTIFY pgrst, 'reload schema';
