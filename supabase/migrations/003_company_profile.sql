-- Nexus Phase 2: split the single company_context blob into a company profile.
-- Apply after 002_admin_configuration.sql.
--
-- "Company context" is now the composed block that agents receive:
--   company_overview        — what the company does, products, customers
--   brand_voice             — tone and style rules for anything written
--   reusable_instructions   — standing rules every agent follows on every mission

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'company_settings'
      and column_name = 'company_context'
  ) then
    alter table public.company_settings
      rename column company_context to company_overview;
  end if;
end
$$;

alter table public.company_settings
  add column if not exists brand_voice           text,
  add column if not exists reusable_instructions text;

comment on column public.company_settings.company_overview is
  'What the company does: products, customers, positioning.';
comment on column public.company_settings.brand_voice is
  'Tone of voice and writing style rules.';
comment on column public.company_settings.reusable_instructions is
  'Standing instructions applied to every agent on every mission.';
