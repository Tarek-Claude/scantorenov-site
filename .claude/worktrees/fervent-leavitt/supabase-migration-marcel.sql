-- ═══════════════════════════════════════════════════════════════
-- MIGRATION : Ajout des colonnes pour le Prompt Marcel
-- À exécuter dans Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Nouvelles colonnes pour les données enrichies du formulaire contact
ALTER TABLE clients ADD COLUMN IF NOT EXISTS genre TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS qualite TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS precision_bien TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS type_projet TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS incluant TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS nb_pieces TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS espaces TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS travaux TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS message_libre TEXT;

-- Colonne principale : le prompt système personnalisé de Marcel
ALTER TABLE clients ADD COLUMN IF NOT EXISTS marcel_system_prompt TEXT;

-- Index pour accélérer la recherche par email (utilisé par chat.js)
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
