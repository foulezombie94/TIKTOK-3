import { NextResponse } from 'next/server'
import Stripe from 'stripe'

// On utilise Stripe en version stricte
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Pas de signature Stripe' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  // Idempotence & Scalabilité
  if (event.type === 'checkout.session.completed') {
    const sessionDetail = event.data.object as any
    const userId = sessionDetail.metadata.userId
    const coinsStr = sessionDetail.metadata.coins

    // LOGIQUE DE SÉCURITÉ ICI :
    // 1. Lire la clé Supabase Service Role (Jamais exposée au client)
    // 2. Faire un UPDATE sur wallets "SET balance = balance + coins WHERE user_id = userId"
    // 3. Logger dans la table stripe_logs pour assurer qu'on ne donne pas les coins 2 fois en cas de requête réseau dupliquée

    console.log(`💲 PAIEMENT REÇU ! Créditer ${coinsStr} Coins à l'utilisateur ${userId}`);
    // Code de crédit Supabase à l'aide de `@supabase/supabase-js` avec supabase_service_role_key...
  }

  return NextResponse.json({ received: true })
}
