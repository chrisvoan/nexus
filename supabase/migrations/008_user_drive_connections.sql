-- Nexus: each employee connects their own Google Drive, and the outputs of
-- their missions are saved there. Apply after 007_squad_custom_instructions.sql.
--
-- As with the company connection (005), only identifiers are stored: Google
-- tokens stay inside Pipedream. The Pipedream external user id is not stored
-- at all; the server derives it from user_id, so a row edited through the API
-- can't point a run at an account connected by someone else.

create table public.user_drive_connections (
  user_id               uuid primary key
    references public.profiles (id) on delete cascade,
  pipedream_account_id  text not null,
  account_name          text,
  connected_at          timestamptz not null default now()
);

comment on table public.user_drive_connections is
  'An employee''s own Google Drive, where their mission outputs are saved. '
  'Without one, outputs fall back to the company Drive.';
comment on column public.user_drive_connections.pipedream_account_id is
  'Pipedream Connect account id (apn_…), connected under the external user '
  'id nexus-user-<user_id>.';
comment on column public.user_drive_connections.account_name is
  'The Google account as Pipedream names it (usually the email address). '
  'Display only.';

alter table public.user_drive_connections enable row level security;

-- Connections are personal: not even admins can read someone else's.
create policy "Users view their own Drive connection"
  on public.user_drive_connections for select to authenticated
  using (user_id = auth.uid());

create policy "Users add their own Drive connection"
  on public.user_drive_connections for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users update their own Drive connection"
  on public.user_drive_connections for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users remove their own Drive connection"
  on public.user_drive_connections for delete to authenticated
  using (user_id = auth.uid());
