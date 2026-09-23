-- Nexus Phase 2: let admins recreate the company_settings singleton.
-- Apply after 003_company_profile.sql.
--
-- 002 seeds the row, but if it is ever missing (a restore, a manual delete, a
-- partially applied migration) the Company page had no way back: there was an
-- update policy but no insert policy, so saving silently matched zero rows.
-- The primary key and its `check (id)` still allow exactly one row.

create policy "Admins can create company settings"
  on public.company_settings for insert to authenticated
  with check (public.get_my_role() = 'admin');

-- Re-seed if it went missing.
insert into public.company_settings (id) values (true) on conflict do nothing;
