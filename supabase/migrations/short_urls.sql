-- =============================================
-- SQL MIGRATION : SHORT URLS (SLUGS) - GRADE PRINCIPAL
-- =============================================

-- 0. Activation des extensions de sécurité
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Générateur Cryptographique (Base62)
-- Utilise gen_random_bytes pour éviter toute prédictibilité des slugs.
CREATE OR REPLACE FUNCTION generate_short_slug(len INT) RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  alphabet_len INT := length(chars);
  result TEXT := '';
  bytes BYTEA;
  i INT;
BEGIN
  -- Récupération de bytes cryptographiquement sécurisés
  bytes := gen_random_bytes(len);
  
  FOR i IN 0..len-1 LOOP
    -- get_byte renvoie 0-255. On utilise le modulo pour mapper sur l'alphabet.
    result := result || substr(chars, (get_byte(bytes, i) % alphabet_len) + 1, 1);
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 2. Fonction Trigger avec Gestion des Collisions
-- Implémente une boucle de régénération en cas d'improbabilité de doublon.
CREATE OR REPLACE FUNCTION auto_generate_video_slug()
RETURNS TRIGGER AS $$
DECLARE
  new_slug TEXT;
  max_retries INT := 10;
  attempts INT := 0;
  found BOOLEAN := false;
BEGIN
  -- Si le slug est déjà fourni, on le garde (pour les imports manuels ou migrations)
  IF NEW.slug IS NOT NULL AND NEW.slug != '' THEN
    RETURN NEW;
  END IF;

  -- Boucle de détection de collision
  WHILE NOT found AND attempts < max_retries LOOP
    new_slug := generate_short_slug(8);
    
    -- Vérifie si le slug existe déjà
    SELECT EXISTS (SELECT 1 FROM videos WHERE slug = new_slug) INTO found;
    
    IF NOT found THEN
      NEW.slug := new_slug;
      RETURN NEW;
    END IF;
    
    attempts := attempts + 1;
  END LOOP;

  -- Fail-safe : Si après 10 tentatives on a toujours une collision (statistiquement impossible)
  -- On laisse l'erreur UNIQUE remonter pour protéger l'intégrité.
  NEW.slug := new_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attachement du Trigger
DROP TRIGGER IF EXISTS trigger_generate_video_slug ON videos;
CREATE TRIGGER trigger_generate_video_slug
BEFORE INSERT ON videos
FOR EACH ROW
EXECUTE FUNCTION auto_generate_video_slug();

-- 4. Contraintes & Performance
-- L'index UNIQUE génère automatiquement un index B-Tree pour des recherches en O(log N).
ALTER TABLE videos DROP CONSTRAINT IF EXISTS unique_video_slug;
ALTER TABLE videos ADD CONSTRAINT unique_video_slug UNIQUE (slug);

-- OPTIONNEL : Tuning de l'index si la table devient massive
-- ALTER INDEX unique_video_slug SET (fillfactor = 90);
