-- Nexus Phase 4: missions and the shared agent runtime environment.
-- Apply after 005_drive_knowledge.sql.

-- ---------------------------------------------------------------------------
-- Company settings: the one Managed Agents Environment every mission Session
-- runs in. Created once by an admin from Integrations.
-- ---------------------------------------------------------------------------

alter table public.company_settings
  add column if not exists anthropic_environment_id text;

comment on column public.company_settings.anthropic_environment_id is
  'Claude Managed Agents environment (env_…) that mission sessions run in.';

-- ---------------------------------------------------------------------------
-- Missions
--
--   queued       → waiting for the employee to press Run
--   in_progress  → a Claude session is running
--   completed    → output saved (output_url when Drive succeeded, and always
--                  output_text as the fallback copy)
--   failed       → the run errored; `error` says why. The brief is untouched,
--                  so the mission can be edited and run again.
-- ---------------------------------------------------------------------------

create type public.mission_status as enum
  ('queued', 'in_progress', 'completed', 'failed');

create type public.mission_output_type as enum ('doc', 'sheet', 'pdf');

create table public.missions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  agent_id        uuid not null references public.agents (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 200),
  brief           text not null check (char_length(brief) between 1 and 20000),
  web_search      boolean not null default false,
  output_type     public.mission_output_type not null default 'doc',
  status          public.mission_status not null default 'queued',
  session_id      text,
  output_url      text,
  output_file_id  text,
  output_text     text,
  output_error    text,
  error           text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on column public.missions.session_id is
  'Claude Managed Agents session (sesn_…). Sessions are never archived, so '
  'every run stays inspectable in the Claude Console.';
comment on column public.missions.output_error is
  'Set on a completed mission whose Drive file could not be created; the '
  'output is still available in output_text.';

create index missions_user_created_idx
  on public.missions (user_id, created_at desc);
create index missions_agent_idx on public.missions (agent_id);

create trigger missions_updated_at
  before update on public.missions
  for each row execute function public.set_updated_at();

alter table public.missions enable row level security;

-- Employees can only brief agents that are in their squad.
create policy "Users create missions for their squad"
  on public.missions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.user_agents ua
      where ua.user_id = auth.uid() and ua.agent_id = missions.agent_id
    )
  );

create policy "Users view their own missions"
  on public.missions for select to authenticated
  using (user_id = auth.uid());

create policy "Admins view all missions"
  on public.missions for select to authenticated
  using (public.get_my_role() = 'admin');

-- Runs write their result back as the employee, so the check deliberately
-- does not re-test squad membership: an agent unassigned mid-run must not
-- strand the mission in progress.
create policy "Users update their own missions"
  on public.missions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users delete their own idle missions"
  on public.missions for delete to authenticated
  using (user_id = auth.uid() and status <> 'in_progress');
