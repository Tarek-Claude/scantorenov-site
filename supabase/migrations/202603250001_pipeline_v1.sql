begin;

alter table public.clients
  add column if not exists status text default 'new_lead',
  add column if not exists phone text,
  add column if not exists project_type text,
  add column if not exists project_details text,
  add column if not exists call_scheduled_at timestamp with time zone,
  add column if not exists call_notes text,
  add column if not exists scan_date_proposed timestamp with time zone,
  add column if not exists scan_date_confirmed timestamp with time zone,
  add column if not exists scan_confirmed_by_client boolean not null default false,
  add column if not exists matterport_url text,
  add column if not exists matterport_model_id text,
  add column if not exists plans_urls text[] not null default '{}',
  add column if not exists photos_urls text[] not null default '{}',
  add column if not exists marcel_enabled boolean not null default false,
  add column if not exists avant_projet_enabled boolean not null default false,
  add column if not exists last_action_required text,
  add column if not exists updated_at timestamp with time zone not null default now();

update public.clients
set
  phone = coalesce(phone, telephone),
  project_type = coalesce(project_type, type_bien),
  project_details = coalesce(project_details, demande),
  matterport_url = coalesce(matterport_url, matterport_iframe),
  updated_at = coalesce(updated_at, now()),
  status = coalesce(
    status,
    case
      when proposal_url is not null then 'avant_projet_ready'
      when matterport_model_id is not null or matterport_iframe is not null then 'scan_completed'
      when phase is not null and phase >= 3 then 'account_created'
      else 'new_lead'
    end
  );

create or replace function public.set_clients_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_clients_updated_at on public.clients;

create trigger trg_clients_updated_at
before insert or update on public.clients
for each row
execute function public.set_clients_updated_at();

commit;
