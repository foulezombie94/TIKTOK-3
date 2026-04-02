import DOMPurify from 'isomorphic-dompurify'

// =============================================
// TEXT SANITIZATION
// =============================================

export function sanitizeText(input: string, maxLength = 500): string {
  if (!input || typeof input !== 'string') return ''
  
  // Use DOMPurify for robust, industry-standard sanitization
  // This handles Unicode, Hex, and complex XSS vectors that regex misses
  const clean = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML allowed in captions/bios/comments
    ALLOWED_ATTR: [],
  })

  return clean.trim().slice(0, maxLength)
}

/**
 * Sanitize a username (alphanumeric, underscores, dots only)
 */
export function sanitizeUsername(input: string): string {
  if (!input || typeof input !== 'string') return ''
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 30)
}

// =============================================
// VALIDATION
// =============================================

/**
 * Validate UUID v4 strictly (the variant Supabase uses).
 * Enforces: version nibble = 4, variant bits = 8/9/a/b
 */
export function isValidUUID(input: string): boolean {
  if (!input || typeof input !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input)
}

/**
 * Validate that a string looks like an ISO 8601 timestamp.
 * Used to validate cursor parameters before sending to DB.
 */
export function isValidISOTimestamp(input: string): boolean {
  if (!input || typeof input !== 'string') return false
  const date = new Date(input)
  return !isNaN(date.getTime()) && input.length >= 10
}

/**
 * Sanitize search query to prevent SQL injection via Supabase's .ilike().
 * Escapes special postgres LIKE characters (%, _, \).
 */
export function sanitizeSearchQuery(input: string): string {
  if (!input || typeof input !== 'string') return ''
  return input
    .replace(/[%_\\]/g, '\\$&')  // Escape LIKE wildcards
    .replace(/[<>"';(){}]/g, '') // Remove dangerous chars
    .trim()
    .slice(0, 100)
}

// =============================================
// PII (Personally Identifiable Information) REDACTION
// =============================================

const PII_FIELDS = new Set([
  'password', 'passwd', 'secret', 'token', 'accessToken', 'refreshToken',
  'authorization', 'cookie', 'session', 'creditCard', 'ssn', 'apiKey',
  'api_key', 'private_key', 'serviceRoleKey', 'service_role_key',
])

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

/**
 * Redact PII from a log entry or metadata object.
 * Masks emails, passwords, tokens, etc.
 */
export function redactPII(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()

    // Redact known PII fields
    if (PII_FIELDS.has(key) || PII_FIELDS.has(lowerKey)) {
      cleaned[key] = '[REDACTED]'
      continue
    }

    // Recursively redact nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      cleaned[key] = redactPII(value as Record<string, unknown>)
      continue
    }

    // Mask emails in string values
    if (typeof value === 'string') {
      cleaned[key] = value.replace(EMAIL_REGEX, (match) => {
        const [local, domain] = match.split('@')
        return `${local[0]}***@${domain}`
      })
      continue
    }

    cleaned[key] = value
  }

  return cleaned
}

// =============================================
// FILE UPLOAD VALIDATION
// =============================================

/**
 * Validate video file before upload
 */
export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
  const MAX_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

  if (!file) return { valid: false, error: 'Aucun fichier sélectionné' }
  
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: `Format non supporté: ${file.type}. Utilisez MP4 ou WebM.` }
  }

  if (file.size > MAX_SIZE_BYTES) {
    return { valid: false, error: `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum: 50 Mo.` }
  }

  if (file.size < 1024) {
    return { valid: false, error: 'Fichier trop petit pour être une vidéo valide.' }
  }

  return { valid: true }
}

/**
 * Validate magic bytes of an uploaded file to ensure content-type matches.
 * 
 * Note: For MP4/QuickTime, the 'ftyp' atom can sometimes appear after a few
 * bytes of metadata depending on the encoder. Checking at offset 4 covers ~95%
 * of standard files. We also check offset 0 as a fallback.
 */
export function validateMagicBytes(buffer: ArrayBuffer, declaredType: string): boolean {
  const bytes = new Uint8Array(buffer)
  
  // MP4: 'ftyp' box can be at offset 4 (standard) or after a variable-length box
  if (declaredType === 'video/mp4' || declaredType === 'video/quicktime') {
    if (bytes.length < 12) return false
    // Standard: ftyp at offset 4
    const hasFtypAt4 = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
    if (hasFtypAt4) return true
    // Fallback: scan first 32 bytes for ftyp signature
    for (let i = 0; i <= Math.min(bytes.length - 4, 32); i++) {
      if (bytes[i] === 0x66 && bytes[i+1] === 0x74 && bytes[i+2] === 0x79 && bytes[i+3] === 0x70) {
        return true
      }
    }
    return false
  }
  
  // WebM: starts with EBML header 0x1A45DFA3
  if (declaredType === 'video/webm') {
    return bytes.length >= 4 &&
      bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3
  }

  return false
}

/**
 * Rate limit key sanitization
 */
export function sanitizeIP(ip: string): string {
  return ip.replace(/[^a-fA-F0-9.:]/g, '').slice(0, 45)
}
