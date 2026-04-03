import { redirect, notFound } from 'next/navigation'

interface ProfilePageProps {
  params: {
    username: string
  }
}

export default async function OfficialTikTokProfilePage({ params }: ProfilePageProps) {
  const { username } = params

  // 🛡️ SECURITY: Le username doit commencer par @ pour correspondre aux URLs TikTok
  const decodedUsername = decodeURIComponent(username)
  if (!decodedUsername.startsWith('@')) {
    // Si ce n'est pas un @username, ce n'est probablement pas un profil (évite les conflits de routes racine)
    return notFound()
  }

  // Redirection vers la page profil existante (ou futur refactoring)
  // On enlève le '@' pour correspondre au paramètre attendu par l'ancienne page si nécessaire
  const cleanUsername = decodedUsername.slice(1)
  
  return redirect(`/profile/${cleanUsername}`)
}
