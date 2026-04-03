-- =============================================
-- SQL MIGRATION : SHORT URLS (SLUGS)
-- =============================================

-- 1. Générateur de chaîne aléatoire (Base62)
-- 8 caractères => ~218 billions de combinaisons
CREATE OR REPLACE FUNCTION generate_short_slug(length INT) RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 2. Fonction Trigger (Auto-Génération)
CREATE OR REPLACE FUNCTION auto_generate_video_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_short_slug(8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attachement du Trigger à la table 'videos'
DROP TRIGGER IF EXISTS trigger_generate_video_slug ON videos;
CREATE TRIGGER trigger_generate_video_slug
BEFORE INSERT ON videos
FOR EACH ROW
EXECUTE FUNCTION auto_generate_video_slug();

-- 4. Contrainte de sécurité (Unicité)
-- Utile pour les index et la performance des requêtes 'eq'
-- ALTER TABLE videos ADD CONSTRAINT unique_video_slug UNIQUE (slug);
