-- 2026-04-20 : persistance des visuels IA generes par Marcel
-- =====================================================================
-- Ajoute une colonne simulations JSONB sur la table clients afin que
-- les rendus IA (Together/Kontext) survivent aux deploiements et aux
-- rechargements de page. Chaque entree suit le schema :
--   {
--     "url":         "<lien Supabase Storage permanent>",
--     "description": "<caption affichee sous le visuel>",
--     "prompt":      "<prompt complet envoye au modele>",
--     "provider":    "together | together-kontext | ...",
--     "created_at":  "<ISO timestamp>"
--   }
-- =====================================================================

alter table public.clients
  add column if not exists simulations jsonb not null default '[]'::jsonb;

create index if not exists idx_clients_simulations_gin
  on public.clients using gin (simulations);

comment on column public.clients.simulations is
  'Visuels IA generes par Marcel : tableau JSONB de { url, description, prompt, provider, created_at }. Les URLs pointent vers le bucket storage "plans" sous-dossier "simulations/".';
