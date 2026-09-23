-- Nexus Phase 2: company settings, agents, and agent assignment ("My Squad").
-- Apply after 001_foundation.sql in Supabase → SQL Editor (or `supabase db push`).

-- Shared updated_at trigger.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles: mirror the auth email so admins can list users without the
-- service-role key. Kept in sync by triggers on auth.users.
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name, email)
  values (new.id, 'user', new.raw_user_meta_data->>'display_name', new.email);
  return new;
end;
$$;

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Email is owned by auth.users; block edits through the API.
create or replace function public.prevent_profile_email_edit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.email is distinct from old.email and auth.uid() is not null then
    raise exception 'Email cannot be changed here';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_email_edit
  before update on public.profiles
  for each row execute function public.prevent_profile_email_edit();

-- ---------------------------------------------------------------------------
-- Company settings: a single row, enforced by a boolean primary key.
-- ---------------------------------------------------------------------------

create table public.company_settings (
  id               boolean primary key default true check (id),
  company_name     text,
  company_context  text,
  updated_by       uuid references public.profiles (id) on delete set null,
  updated_at       timestamptz not null default now()
);

alter table public.company_settings enable row level security;

-- Every signed-in user can read it: mission runs inject the company context.
create policy "Authenticated users can view company settings"
  on public.company_settings for select to authenticated
  using (true);

create policy "Admins can update company settings"
  on public.company_settings for update to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create trigger company_settings_updated_at
  before update on public.company_settings
  for each row execute function public.set_updated_at();

insert into public.company_settings (id) values (true) on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Agents: the Nexus record is the source of truth; claude_agent_id links the
-- Claude Managed Agent. sync_status tracks whether the remote copy matches.
-- ---------------------------------------------------------------------------

create table public.agents (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (char_length(name) between 1 and 100),
  description           text,
  system_prompt         text not null default '',
  model                 text not null,
  claude_agent_id       text unique,
  claude_agent_version  integer,
  sync_status           text not null default 'pending'
                          check (sync_status in ('pending', 'synced', 'error')),
  sync_error            text,
  synced_at             timestamptz,
  archived_at           timestamptz,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.agents enable row level security;

create trigger agents_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

create policy "Admins manage agents"
  on public.agents for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- User ↔ agent assignment. Admins decide each employee's squad.
-- ---------------------------------------------------------------------------

create table public.user_agents (
  user_id              uuid not null references public.profiles (id) on delete cascade,
  agent_id             uuid not null references public.agents (id) on delete cascade,
  custom_instructions  text,
  assigned_by          uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  primary key (user_id, agent_id)
);

create index user_agents_agent_idx on public.user_agents (agent_id);

alter table public.user_agents enable row level security;

create policy "Admins manage agent assignments"
  on public.user_agents for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create policy "Users can view their own assignments"
  on public.user_agents for select to authenticated
  using (user_id = auth.uid());

-- Users may only see agents that are assigned to them and not archived.
-- Defined after user_agents because it references that table.
create policy "Users can view their assigned agents"
  on public.agents for select to authenticated
  using (
    archived_at is null
    and exists (
      select 1 from public.user_agents ua
      where ua.agent_id = agents.id and ua.user_id = auth.uid()
    )
  );
