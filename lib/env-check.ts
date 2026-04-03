/**
 * Environment Variables Validation — Pilier 3: Sécurité (v1)
 * 
 * Verifies that all critical environment variables are present at startup.
 * Throws a descriptive error if any are missing.
 */

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
]

export function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key])

  if (missing.length > 0) {
    const errorMsg = `
[CRITICAL] Missing required environment variables:
${missing.map((key) => ` - ${key}`).join('\n')}

Please check your .env.local or production environmental variables.
    `.trim()

    // En mode développement, on logge mais on ne bloque pas forcément tout le serveur
    // pour éviter de frustrer les devs. En production, on crash.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(errorMsg)
    } else {
      console.error(errorMsg)
    }
  }
}

// Auto-run on import if we're on the server
if (typeof window === 'undefined') {
  validateEnv()
}
