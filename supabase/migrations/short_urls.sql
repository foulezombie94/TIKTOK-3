-- =============================================
-- SQL MIGRATION : SHORT URLS (SLUGS) - GRADE 10/10 (ELITE CUSTOM)
-- =============================================

-- 0. Activation des extensions de sécurité
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Assistant de transformation (Slug exists?)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'slug') THEN
    ALTER TABLE videos ADD COLUMN slug VARCHAR(8);
  END IF;
END $$;

-- 2. Générateur Cryptographique Pur (Base62)
CREATE OR REPLACE FUNCTION generate_short_slug(len INT) RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  alphabet_len INT := 62;
  result TEXT := '';
  byte INT;
  i INT := 0;
BEGIN
  WHILE i < len LOOP
    byte := get_byte(gen_random_bytes(1), 0);
    IF byte < 248 THEN
      result := result || substr(chars, (byte % alphabet_len) + 1, 1);
      i := i + 1;
    END IF;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 3. Fonction Trigger (Gestion des Doublons)
CREATE OR REPLACE FUNCTION auto_generate_video_slug()
RETURNS TRIGGER AS $$
DECLARE
  new_slug TEXT;
  found BOOLEAN := true;
  attempts INT := 0;
  max_retries INT := 10;
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug != '' THEN
    RETURN NEW;
  END IF;

  WHILE found AND attempts < max_retries LOOP
    new_slug := generate_short_slug(8);
    SELECT EXISTS (SELECT 1 FROM videos WHERE slug = new_slug) INTO found;
    IF NOT found THEN
      NEW.slug := new_slug;
      RETURN NEW;
    END IF;
    attempts := attempts + 1;
  END LOOP;
  NEW.slug := new_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attachement du Trigger
DROP TRIGGER IF EXISTS trigger_generate_video_slug ON videos;
CREATE TRIGGER trigger_generate_video_slug
BEFORE INSERT ON videos
FOR EACH ROW
EXECUTE FUNCTION auto_generate_video_slug();

-- 5. Migration des données existantes (CRITIQUE pour le fonctionnement immédiat)
UPDATE videos SET slug = generate_short_slug(8) WHERE slug IS NULL;

-- 6. Contraintes & Performance
ALTER TABLE videos ALTER COLUMN slug TYPE VARCHAR(8);
ALTER TABLE videos DROP CONSTRAINT IF EXISTS unique_video_slug;
ALTER TABLE videos ADD CONSTRAINT unique_video_slug UNIQUE (slug);
