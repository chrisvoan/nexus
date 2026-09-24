-- Nexus Phase 3: org-level Google Drive connection + per-agent knowledge files.
-- Apply after 004_company_settings_upsert.sql.
--
-- Only identifiers are stored here. Google tokens stay inside Pipedream, and
-- Drive file contents are fetched fresh on every read — nothing is copied into
-- Supabase.

-- ---------------------------------------------------------------------------
-- Company settings: the single org Drive connection.
-- ---------------------------------------------------------------------------

alter table public.company_settings
  add column if not exists pipedream_account_id       text,
  add column if not exists pipedream_external_user_id text,
  add column if not exists pipedream_connected_by     uuid
    references public.profiles (id) on delete set null,
  add column if not exists pipedream_connected_at     timestamptz;

comment on column public.company_settings.pipedream_account_id is
  'Pipedream Connect account id (apn_…) for the company Google Drive.';
comment on column public.company_settings.pipedream_external_user_id is
  'The external user id the account was connected under. Stored rather than '
  'assumed so a change to the app-side constant cannot orphan a live connection.';
comment on column public.company_settings.pipedream_connected_by is
  'Admin who completed the OAuth flow. Informational only — the connection '
  'belongs to the company, and any admin can disconnect it.';

-- ---------------------------------------------------------------------------
-- Agent knowledge: Drive files an admin pins to an agent.
-- ---------------------------------------------------------------------------

create table public.agent_knowledge (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references public.agents (id) on delete cascade,
  file_id         text not null,
  file_name       text not null,
  file_mime_type  text not null,
  added_by        uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (agent_id, file_id)
);

create index agent_knowledge_agent_idx on public.agent_knowledge (agent_id);

alter table public.agent_knowledge enable row level security;

-- Mission runs (Phase 4) happen as the signed-in employee and must be able to
-- resolve the pinned files for the agent they are running.
create policy "Authenticated users can view agent knowledge"
  on public.agent_knowledge for select to authenticated
  using (true);

create policy "Admins manage agent knowledge"
  on public.agent_knowledge for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
