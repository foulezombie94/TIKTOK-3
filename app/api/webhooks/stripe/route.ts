import { NextResponse } from 'next/server'
import { createLogger, generateCorrelationId } from '@/lib/logger'

// IMPORTANT: On n'initialise PAS Stripe au top-level du module.
// Si on le fait, Next.js tente de l'exécuter au BUILD et plante
// car STRIPE_SECRET_KEY n'existe pas dans l'environnement Vercel Build.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const correlationId = req.headers.get('x-correlation-id') || generateCorrelationId()
  const log = createLogger({ correlationId, path: '/api/webhooks/stripe' })

  // Lazy imports
  const Stripe = (await import('stripe')).default
  const { createClient } = await import('@supabase/supabase-js')

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!stripeSecretKey || !webhookSecret) {
    log.error('Missing Stripe environment variables')
    return NextResponse.json({ error: 'Configuration serveur invalide' }, { status: 500 })
  }

  if (!supabaseUrl || !serviceRoleKey) {
    log.error('Missing Supabase environment variables')
    return NextResponse.json({ error: 'Configuration serveur invalide' }, { status: 500 })
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20' as any
  })

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    log.warn('Webhook request without Stripe signature')
    return NextResponse.json({ error: 'Pas de signature Stripe' }, { status: 400 })
  }

  let event: import('stripe').Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    log.error(`Webhook signature verification failed`, err)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  log.info(`Stripe event received: ${event.type}`, { eventId: event.id })

  // === Handle checkout completion ===
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any
    const userId = session.metadata?.userId
    const coinsStr = session.metadata?.coins
    const coins = parseInt(coinsStr || '0', 10)

    if (!userId || !coins || coins <= 0) {
      log.warn('Checkout completed but missing userId or coins in metadata', { 
        userId, coins: coinsStr 
      })
      return NextResponse.json({ received: true })
    }

    log.info(`Processing coin credit via Transactional RPC`, { userId, coins })

    try {
      const { error: rpcError } = await supabaseAdmin.rpc('process_coin_purchase', {
        p_user_id: userId,
        p_amount: coins,
        p_stripe_session_id: session.id
      })

      if (rpcError) throw rpcError

      log.info(`Successfully processed transaction for user ${userId}`, { 
        userId, coins, stripeSessionId: session.id 
      })
    } catch (err) {
      log.error(`Failed to execute coin purchase transaction`, err as Error, { userId, coins })
      return NextResponse.json({ error: 'Échec de la transaction' }, { status: 500 })
    }
  }

  // === Handle payment failed ===
  if (event.type === 'checkout.session.expired' || event.type === 'payment_intent.payment_failed') {
    const session = event.data.object as any
    log.warn(`Payment failed or expired`, { 
      sessionId: session.id, 
      userId: session.metadata?.userId 
    })
  }

  return NextResponse.json({ received: true })
}
