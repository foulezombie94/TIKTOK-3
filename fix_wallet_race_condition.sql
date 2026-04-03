-- =============================================
-- FIX: Race Condition sur les Portefeuilles (v2)
-- =============================================

CREATE OR REPLACE FUNCTION send_gift(p_sender_id uuid, p_receiver_id uuid, p_amount int, p_video_id uuid)
RETURNS boolean AS $$
DECLARE
  v_sender_balance int;
BEGIN
  -- 1. Verrouillage strict de l'envoyeur
  SELECT balance INTO v_sender_balance FROM public.wallets WHERE user_id = p_sender_id FOR UPDATE; 
  IF v_sender_balance IS NULL OR v_sender_balance < p_amount THEN
    RAISE EXCEPTION 'Solde insuffisant';
  END IF;

  -- 2. Déduction
  UPDATE public.wallets SET balance = balance - p_amount WHERE user_id = p_sender_id;
  
  -- 3. Verrouillage strict du receveur (Garantie d'intégrité totale lors de transactions massives)
  -- On s'assure d'abord que la ligne existe sans bloquer
  INSERT INTO public.wallets (user_id, balance) VALUES (p_receiver_id, 0) ON CONFLICT DO NOTHING;
  -- On pose le verrou exclusif sur la ligne du receveur
  PERFORM balance FROM public.wallets WHERE user_id = p_receiver_id FOR UPDATE;

  -- 4. Crédit
  UPDATE public.wallets SET balance = balance + p_amount WHERE user_id = p_receiver_id;

  -- 5. Traçabilité
  INSERT INTO public.transactions (sender_id, receiver_id, amount, type, video_id)
  VALUES (p_sender_id, p_receiver_id, p_amount, 'gift', p_video_id);

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
