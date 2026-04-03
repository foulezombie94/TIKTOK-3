/**
 * Environment Variables Validation — Pilier 3: Sécurité (v1)
 * 
 * Verifies that all critical environment variables are present at startup.
 * Throws a descriptive error if any are missing.
 */

// 🚨 CRITICAL: The app CRASHES in production if these are missing.
const CRITICAL_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]

// ⚠️ OPTIONAL/DEGRADED: The app warns but RUNS if these are missing.
const FEATURE_ENV_VARS = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
]

export function validateEnv() {
  const missingCritical = CRITICAL_ENV_VARS.filter((key) => !process.env[key])
  const missingFeatures = FEATURE_ENV_VARS.filter((key) => !process.env[key])

  // 1. Handle Critical Failures (Supabase)
  if (missingCritical.length > 0) {
    const errorMsg = `
[CRITICAL] Missing Supabase environment variables:
${missingCritical.map((key) => ` - ${key}`).join('\n')}
BUILD FAILED. Please add these in Vercel.
    `.trim()

    if (process.env.NODE_ENV === 'production') {
      throw new Error(errorMsg)
    } else {
      console.error(errorMsg)
    }
  }

  // 2. Handle Feature Degradation (Upstash, Stripe)
  if (missingFeatures.length > 0) {
    console.warn(`
[WARNING] Some features are disabled (Missing Env Vars):
${missingFeatures.map((key) => ` - ${key}`).join('\n')}
Functional but unsecured/monetization-off.
    `.trim())
  }
}

// Auto-run on import if we're on the server
if (typeof window === 'undefined') {
  validateEnv()
}
