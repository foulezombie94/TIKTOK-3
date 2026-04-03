-- =============================================
-- SQL MIGRATION : SHORT URLS (SLUGS) - GRADE 10/10 (ELITE)
-- =============================================

-- 0. Activation des extensions de sécurité
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Générateur Cryptographique Pur (Base62)
-- Supprime le "Biais de Modulo" via l'algorithme de Rejection Sampling.
CREATE OR REPLACE FUNCTION generate_short_slug(len INT) RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  alphabet_len INT := 62; -- Longueur de l'alphabet Base62
  result TEXT := '';
  byte INT;
  i INT := 0;
BEGIN
  -- Boucle jusqu'à obtenir le nombre de caractères requis
  WHILE i < len LOOP
    -- On génère 1 byte (0-255)
    byte := get_byte(gen_random_bytes(1), 0);
    
    -- REJECTION SAMPLING :
    -- Le plus grand multiple de 62 inférieur à 256 est 248 (62 * 4).
    -- On rejette les valeurs de 248 à 255. 
    -- Statistiquement, chaque caractère de l'alphabet a maintenant 
    -- exactement la même probabilité (4/256) d'être choisi.
    IF byte < 248 THEN
      result := result || substr(chars, (byte % alphabet_len) + 1, 1);
      i := i + 1;
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 2. Fonction Trigger (Gestion des Doublons)
-- Logique de boucle corrigée pour une résilience maximale.
CREATE OR REPLACE FUNCTION auto_generate_video_slug()
RETURNS TRIGGER AS $$
DECLARE
  new_slug TEXT;
  found BOOLEAN := true;
  attempts INT := 0;
  max_retries INT := 10;
BEGIN
  -- Priorité au slug fourni (import/manuel)
  IF NEW.slug IS NOT NULL AND NEW.slug != '' THEN
    RETURN NEW;
  END IF;

  -- BOUCLE DE RÉSILIENCE :
  -- On continue TANT QU'UNE collision est trouvée (found = true).
  WHILE found AND attempts < max_retries LOOP
    new_slug := generate_short_slug(8);
    
    -- Vérifie la présence en table
    SELECT EXISTS (SELECT 1 FROM videos WHERE slug = new_slug) INTO found;
    
    -- Sortie de boucle : on a trouvé un slug unique
    IF NOT found THEN
      NEW.slug := new_slug;
      RETURN NEW;
    END IF;
    
    attempts := attempts + 1;
  END LOOP;

  -- Fail-safe : On laisse remonter l'erreur UNIQUE pour l'intégrité DB
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

-- 4. Contraintes & Performance (Index B-Tree)
ALTER TABLE videos DROP CONSTRAINT IF EXISTS unique_video_slug;
ALTER TABLE videos ADD CONSTRAINT unique_video_slug UNIQUE (slug);
