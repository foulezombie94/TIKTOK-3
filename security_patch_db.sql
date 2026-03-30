-- ==========================================
-- PATCH SÉCURITÉ ARCHITECTURAL TOTAL
-- ==========================================

-- 1. FAILLE : VOL DE COINS & AUTO-DON (Monétisation)
-- La fonction s'appuie désormais STRICTEMENT sur auth.uid() au lieu de p_sender_id.
CREATE OR REPLACE FUNCTION send_gift(p_receiver_id uuid, p_amount int, p_video_id uuid)
RETURNS boolean AS $$
DECLARE
  v_sender_id uuid := auth.uid();
  v_sender_balance int;
BEGIN
  IF v_sender_id IS NULL THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  IF v_sender_id = p_receiver_id THEN RAISE EXCEPTION 'Vous ne pouvez pas vous envoyer de cadeaux'; END IF;

  SELECT balance INTO v_sender_balance FROM public.wallets WHERE user_id = v_sender_id FOR UPDATE; 
  IF v_sender_balance IS NULL OR v_sender_balance < p_amount THEN
    RAISE EXCEPTION 'Solde insuffisant';
  END IF;

  UPDATE public.wallets SET balance = balance - p_amount WHERE user_id = v_sender_id;
  
  INSERT INTO public.wallets (user_id, balance) VALUES (p_receiver_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + p_amount;

  INSERT INTO public.transactions (sender_id, receiver_id, amount, type, video_id)
  VALUES (v_sender_id, p_receiver_id, p_amount, 'gift', p_video_id);

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. FAILLE : ESPOINAGE DE REVENUS (Analytics)
CREATE OR REPLACE FUNCTION get_creator_dashboard(p_creator_id uuid)
RETURNS json AS $$
DECLARE
  v_stats json;
BEGIN
  -- Blocage intrusif: Impossible de voir le dashboard d'un autre
  IF auth.uid() != p_creator_id THEN 
    RAISE EXCEPTION 'Accès refusé au dashboard'; 
  END IF;

  SELECT json_build_object(
    'total_views_30d', (SELECT COALESCE(SUM(daily_views), 0) FROM creator_stats_daily WHERE creator_id = p_creator_id AND date > NOW() - INTERVAL '30 days'),
    'total_coins', (SELECT COALESCE(balance, 0) FROM public.wallets WHERE user_id = p_creator_id),
    'chartData', (
        SELECT json_agg(json_build_object('date', date, 'daily_views', daily_views))
        FROM (SELECT date, daily_views FROM creator_stats_daily WHERE creator_id = p_creator_id ORDER BY date ASC) as sub
    )
  ) INTO v_stats;
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. FAILLE : HISTORIQUE FINANCIER EXPOSÉ (RLS)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Transactions owner" ON public.transactions;
CREATE POLICY "Transactions owner" ON public.transactions 
FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);


-- 4. FAILLE : SPAM NOTIFICATIONS (Flood UX)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS unique_notification;
-- L'unicité garantit qu'un utilisateur ne peut pas spamer 1000 likes sur la même vidéo
-- On nettoie d'abord les doublons existants pour éviter l'erreur 23505
DELETE FROM public.notifications a
USING public.notifications b
WHERE a.id < b.id 
  AND a.user_id = b.user_id 
  AND a.actor_id = b.actor_id 
  AND a.video_id = b.video_id 
  AND a.type = b.type;

ALTER TABLE public.notifications ADD CONSTRAINT unique_notification UNIQUE (user_id, actor_id, video_id, type);

CREATE OR REPLACE FUNCTION public.handle_new_like()
RETURNS TRIGGER AS $$
DECLARE v_owner_id uuid;
BEGIN
  SELECT user_id INTO v_owner_id FROM public.videos WHERE id = NEW.video_id;
  IF v_owner_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, video_id, type)
    VALUES (v_owner_id, NEW.user_id, NEW.video_id, 'like')
    -- On ignore l'insertion si elle existe déjà, ce qui stoppe le flood
    ON CONFLICT ON CONSTRAINT unique_notification DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. FAILLE : PIRATAGE FICHIERS (Bypass Storage 50 Mo)
-- Forces le Backend Supabase à rejeter tout fichier de > 50 Mo ou de type non vidéo pour le bucket 'videos'
UPDATE storage.buckets 
SET file_size_limit = 52428800, allowed_mime_types = ARRAY['video/mp4', 'video/webm']
WHERE id = 'videos';
