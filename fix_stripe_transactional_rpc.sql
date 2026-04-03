-- ==============================================
-- FIX : TRANSACTION ATOMIQUE STRIPE
-- ==============================================

-- Cette fonction garantit que l'utilisateur reçoit ses pièces 
-- ET que la transaction est enregistrée de façon inséparable.

CREATE OR REPLACE FUNCTION process_coin_purchase(
  p_user_id uuid,
  p_amount int,
  p_stripe_session_id text
)
RETURNS boolean AS $$
BEGIN
  -- 1. Créditer le portefeuille (Upsert balance)
  -- Si le wallet n'existe pas, il est créé. S'il existe, on ajoute le montant.
  INSERT INTO public.wallets (user_id, balance) 
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) 
  DO UPDATE SET balance = public.wallets.balance + p_amount;

  -- 2. Enregistrer la transaction (Audit trail)
  INSERT INTO public.transactions (
    sender_id, 
    receiver_id, 
    amount, 
    type, 
    metadata
  ) VALUES (
    NULL, -- Système
    p_user_id, 
    p_amount, 
    'purchase', 
    jsonb_build_object('stripe_session_id', p_stripe_session_id)
  );

  RETURN true;

EXCEPTION WHEN OTHERS THEN
  -- En cas d'erreur, tout est annulé (Rollback automatique de PG)
  RAISE EXCEPTION 'Échec du traitement de l''achat Stripe : %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
