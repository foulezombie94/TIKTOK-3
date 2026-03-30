-- ==========================================
-- PHASE 3: MONÉTISATION, DASHBOARD ET ADMIN
-- ==========================================

-- ------------------------------------------
-- 1. MONÉTISATION (WALLETS ET TRANSACTIONS)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallets (
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  balance integer DEFAULT 0 CHECK (balance >= 0)
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid REFERENCES public.users(id),
  receiver_id uuid REFERENCES public.users(id),
  amount integer NOT NULL CHECK (amount > 0),
  type text NOT NULL CHECK (type IN ('purchase', 'gift')),
  video_id uuid REFERENCES public.videos(id), -- Nullable pour l'achat de coins purs
  created_at timestamp with time zone DEFAULT now()
);

-- PL/pgSQL pour l'envoi de cadeaux avec Verrouillage
CREATE OR REPLACE FUNCTION send_gift(p_sender_id uuid, p_receiver_id uuid, p_amount int, p_video_id uuid)
RETURNS boolean AS $$
DECLARE
  v_sender_balance int;
BEGIN
  -- FOR UPDATE bloque la ligne pour empêcher 2 requêtes parallèles de créer un solde négatif
  SELECT balance INTO v_sender_balance FROM public.wallets WHERE user_id = p_sender_id FOR UPDATE; 
  IF v_sender_balance IS NULL OR v_sender_balance < p_amount THEN
    RAISE EXCEPTION 'Solde insuffisant';
  END IF;

  -- Déduction
  UPDATE public.wallets SET balance = balance - p_amount WHERE user_id = p_sender_id;
  
  -- Crédit (On crée le wallet du receveur au cas où il n'existe pas)
  INSERT INTO public.wallets (user_id, balance) VALUES (p_receiver_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + p_amount;

  -- Traçabilité
  INSERT INTO public.transactions (sender_id, receiver_id, amount, type, video_id)
  VALUES (p_sender_id, p_receiver_id, p_amount, 'gift', p_video_id);

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Sécurisé
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture propre wallet" ON public.wallets;
CREATE POLICY "Lecture propre wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
-- Pas de politique UPDATE/INSERT : seule la fonction send_gift et les Webhooks serveur le peuvent.

-- ------------------------------------------
-- 2. DASHBOARD (VUES MATÉRIALISÉES)
-- ------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS creator_stats_daily AS
SELECT 
  v.user_id AS creator_id,
  DATE_TRUNC('day', vv.created_at) AS date,
  COUNT(vv.id) AS daily_views
FROM public.videos v
JOIN public.video_views vv ON v.id = vv.video_id
GROUP BY v.user_id, DATE_TRUNC('day', vv.created_at);

-- Activer l'extension CRON
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Index unique requis pour REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_stats_daily_unique ON public.creator_stats_daily (creator_id, date);

-- Créer une tâche planifiée pour rafraîchir la vue toutes les heures
SELECT cron.schedule(
  'refresh_creator_stats',
  '0 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY public.creator_stats_daily;'
);

-- Fonction rapide pour lire les stats
CREATE OR REPLACE FUNCTION get_creator_dashboard(p_creator_id uuid)
RETURNS json AS $$
DECLARE
  v_stats json;
BEGIN
  SELECT json_build_object(
    'total_views_30d', (SELECT COALESCE(SUM(daily_views), 0) FROM creator_stats_daily WHERE creator_id = p_creator_id AND date > NOW() - INTERVAL '30 days'),
    'total_coins', (SELECT COALESCE(balance, 0) FROM public.wallets WHERE user_id = p_creator_id),
    'chartData', (
        SELECT json_agg(json_build_object('date', date, 'daily_views', daily_views))
        FROM (
            SELECT date, daily_views FROM creator_stats_daily WHERE creator_id = p_creator_id ORDER BY date ASC
        ) as sub
    )
  ) INTO v_stats;
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------
-- 3. MODÉRATION (ADMIN ET REPORTS)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_roles (
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  level_access text DEFAULT 'moderator'
);

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid REFERENCES public.users(id),
  video_id uuid REFERENCES public.videos(id),
  reason text NOT NULL,
  status text DEFAULT 'pending', -- pending, resolved, rejected
  created_at timestamp with time zone DEFAULT now()
);

-- RLS Analytics et Admin
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 1. N'importe quel utilisateur connecté peut CRÉER un signalement
DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
CREATE POLICY "Users can create reports" ON public.reports 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- 2. Seuls les admins peuvent VOIR, MODIFIER ou SUPPRIMER les signalements
DROP POLICY IF EXISTS "Admins manage reports" ON public.reports;
CREATE POLICY "Admins manage reports" ON public.reports 
FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()));

-- Ajoute-toi manuellement en tant qu'admin (Remplace par TON propre ID)
-- INSERT INTO public.admin_roles (user_id) VALUES ('TON_UUID_ICI');
