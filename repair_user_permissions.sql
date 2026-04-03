-- 🛡️ FIX PERMISSIONS : Accès Public aux Profils (Grade Elite)
-- Résout l'erreur : "permission denied for table users" lors du chargement des vidéos.

-- 1. Autoriser explicitement la lecture sur la table users pour les rôles anon et authenticated
GRANT SELECT ON public.users TO anon, authenticated;

-- 2. Configuration de la Politique RLS (Row Level Security)
-- On autorise tout le monde (même non connecté) à LIRE les profils (username, avatar, etc.)
-- C'est indispensable pour afficher qui a posté une vidéo dans le feed ou sur une page dédiée.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
CREATE POLICY "Public profiles are viewable by everyone"
ON public.users FOR SELECT
TO public
USING (true);

-- 💡 Note Pro : La table 'users' contient des données publiques (social). 
-- Les données sensibles (email, etc.) devraient être dans une autre table 
-- ou protégées par des vues, mais ici 'users' est la table de profil public.

-- Vérification des colonnes pour s'assurer que 'id' est bien présent
-- (Certains schémas utilisent 'id' lié à auth.users.id)
