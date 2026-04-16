-- Marcel Sprint 2 : Métadonnées des photos pour contexte IA
-- Permet au chef de projet d'annoter les photos sélectionnées
-- (pièce, vue, caption, priorité) pour que Marcel réponde pertinemment
-- même quand le client envoie une photo sans texte.

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS photos_meta JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.scans.photos_meta IS
'Array d''objets { url, room, view, caption, priority } correspondant à scans.photos_urls. Permet à Marcel d''identifier la pièce et le contexte sans interroger le client.';

-- Index pour futures recherches sur les métadonnées
CREATE INDEX IF NOT EXISTS idx_scans_photos_meta ON public.scans USING gin (photos_meta);
