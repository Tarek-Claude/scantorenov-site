begin;

alter table public.clients
  alter column status set default 'contact_submitted';

update public.clients
set status = case status
  when 'new_lead' then 'contact_submitted'
  when 'account_created' then 'identity_created'
  when 'avant_project_transmitted' then 'avant_projet_transmitted'
  else status
end
where status in ('new_lead', 'account_created', 'avant_project_transmitted');

alter table public.clients
  add column if not exists paused_at timestamptz,
  add column if not exists pause_reason text,
  add column if not exists abandoned_at timestamptz,
  add column if not exists last_client_activity_at timestamptz,
  add column if not exists status_updated_at timestamptz not null default now();

create table if not exists public.admin_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  task_type text not null,
  title text not null,
  description text,
  status text not null default 'open',
  previous_status text,
  priority integer not null default 50,
  owner text not null default 'scantorenov',
  due_date timestamptz,
  screen_target text,
  created_from text,
  blocking_reason text,
  proof_required text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists idx_admin_tasks_client_id
  on public.admin_tasks(client_id);

create index if not exists idx_admin_tasks_status_priority
  on public.admin_tasks(status, priority desc, due_date asc nulls last);

create unique index if not exists idx_admin_tasks_active_unique
  on public.admin_tasks(client_id, task_type)
  where status in ('open', 'awaiting_validation', 'waiting_client', 'blocked');

create table if not exists public.knowledge_candidates (
  id uuid primary key default gen_random_uuid(),
  source_client_id uuid references public.clients(id) on delete set null,
  proposed_by text not null default 'marcel',
  content text not null,
  status text not null default 'pending',
  validated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  validated_at timestamptz
);

create index if not exists idx_knowledge_candidates_status
  on public.knowledge_candidates(status, created_at desc);

create table if not exists public.onboarding_step_validations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  step_key text not null,
  proof_type text,
  proof_payload jsonb not null default '{}'::jsonb,
  validated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, step_key)
);

create index if not exists idx_onboarding_step_validations_client_id
  on public.onboarding_step_validations(client_id);

create or replace function public.set_generic_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_admin_tasks_updated_at on public.admin_tasks;
create trigger trg_admin_tasks_updated_at
before update on public.admin_tasks
for each row
execute function public.set_generic_updated_at();

drop trigger if exists trg_knowledge_candidates_updated_at on public.knowledge_candidates;
create trigger trg_knowledge_candidates_updated_at
before update on public.knowledge_candidates
for each row
execute function public.set_generic_updated_at();

drop trigger if exists trg_onboarding_step_validations_updated_at on public.onboarding_step_validations;
create trigger trg_onboarding_step_validations_updated_at
before update on public.onboarding_step_validations
for each row
execute function public.set_generic_updated_at();

update public.clients
set status_updated_at = coalesce(updated_at, created_at, now())
where status_updated_at is null;

commit;
