/**
 * 🛡️ DEVICE FINGERPRINTING : TikTok Clone (V5 - Hardcore)
 * Génère un identifiant matériel (Hardware ID) robuste unique pour chaque appareil.
 * Compatible : iPhone, Android, Samsung, Tablettes, PC.
 */

export const getHardwareId = (): string => {
  if (typeof window === 'undefined') return 'server'

  // 1. Récupération de l'ID persistant s'il existe
  const storedId = localStorage.getItem('_tk_dev_id')
  if (storedId && storedId.length > 20) return storedId

  // 2. Génération d'un Fingerprint basé sur les caractéristiques matérielles (ENTROPY INCREMENTED)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  let canvasFp = ''
  if (ctx) {
    ctx.textBaseline = "top"
    ctx.font = "14px 'Arial'"
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = "#f60"
    ctx.fillRect(125, 1, 62, 20)
    ctx.fillStyle = "#069"
    ctx.fillText("TikTok_Security_V5", 2, 15)
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)"
    ctx.fillText("TikTok_Security_V5", 4, 17)
    canvasFp = canvas.toDataURL()
  }

  // Éléments d'entropie supplémentaires pour différencier iPhone/Android/PC
  const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`
  const ua = navigator.userAgent
  const lang = navigator.language
  const cores = navigator.hardwareConcurrency || 'N/A'
  const mem = (navigator as any).deviceMemory || 'N/A'
  const platform = (navigator as any).platform || 'N/A'
  
  // Combine all attributes into a single string
  const rawId = `${canvasFp.slice(-50)}|${screenInfo}|${ua}|${lang}|${cores}|${mem}|${platform}`
  
  // Hash propre et sécurisé
  const hashedId = `HWV5_${btoa(unescape(encodeURIComponent(rawId.slice(0, 150)))).replace(/[/+=]/g, '').slice(0, 32)}`
  
  // Stockage définitif (Cookie + LocalStorage)
  document.cookie = `_tk_dev_id=${hashedId}; path=/; max-age=315360000; SameSite=Lax; Secure`
  localStorage.setItem('_tk_dev_id', hashedId)
  
  return hashedId
}

/**
 * 🛰️ SYNCHRONISATION RÉSEAU (API V5)
 * Version SERVEUR : L'IP est récupérée par l'API pour une fiabilité à 100%.
 */
export const syncNetworkIdentifiers = async (supabase: any, userId: string) => {
  try {
    if (!userId) return

    const hardwareId = getHardwareId()
    
    // 🔥 APPEL API SERVEUR (Remplace Ipify & RLS)
    const res = await fetch('/api/security/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, hardwareId })
    })

    if (res.ok) {
     console.log("🛡️ NOC-V5 : Empreinte de sécurité validée.");
    } else {
     console.warn("Échec Sync Sécurité NOC-V5.");
    }
  } catch (err) {
    console.error("Erreur Sync NOC-V5:", err)
  }
}
