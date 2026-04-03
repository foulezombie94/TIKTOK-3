# Spécification Technique : Système de Partage de Vidéos (Short URLs)

## 🎯 L'Objectif et le Flux Utilisateur
L'objectif est de fournir aux utilisateurs un lien de partage court, esthétique, et qui ne changera jamais, même si la base de données évolue.

### Le parcours utilisateur (User Flow)
1.  **Création** : Lorsqu'un utilisateur publie une vidéo, la base de données génère instantanément et silencieusement un code unique à 8 caractères (le slug).
2.  **Partage** : L'utilisateur clique sur "Partager". L'interface génère un lien propre du type `tiktok-clone.com/v/aB7x9Kp2`.
3.  **Consommation** : Un ami clique sur le lien. Le serveur Next.js intercepte ce lien, lit les métadonnées pour afficher un bel aperçu sur iMessage/Discord/Twitter, puis charge le lecteur vidéo en plein écran.

## 🛡️ Architecture de Sécurité
- **Immuabilité (Database-Driven)** : Le frontend ne génère jamais le slug. C'est le serveur SQL (Supabase) qui s'en charge via un Trigger. Cela empêche l'injection de slugs personnalisés lors de l'upload.
- **Prévention SQL Injection / DDoS** : Utilisation d'une Regex stricte pour valider les slugs et UUID avant toute requête SQL. Si le format est invalide, la requête est rejetée instantanément.
- **Fallback Tolérant aux Pannes** : Si un lien contient un UUID au lieu d'un slug, le système reste capable de retrouver la vidéo.

## 💾 Couche 1 : Base de Données (SQL Trigger)
- **Générateur (Base62)** : Fonction SQL produisant une chaîne de 8 caractères.
- **Trigger** : Automatique sur `BEFORE INSERT` pour la table `videos`.
- **Contrainte** : Index `UNIQUE` sur la colonne `slug`.

## 📱 Couche 2 : Frontend (ShareSheet.tsx)
Le composant utilise dynamiquement `${window.location.origin}/v/${video.slug || video.id}`.

## ⚙️ Couche 3 : Backend (page.tsx / SEO)
- **Metadata** : Génération des balises Open Graph et Twitter Card pour les prévisualisations sociales.
- **Routage Hardened** : Double tentative (Slug puis Fallback UUID) avec redirection sécurisée.
