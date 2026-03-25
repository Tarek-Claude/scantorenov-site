begin;

alter table public.clients
  add column if not exists prenom text;

commit;
