-- GadeSystem — migration: template field mapping GIS (AGENTS.md §24:
-- "Mapping template dapat disimpan").
-- mapping = objek JSON { sourceField: gadeField }.

create table if not exists public.gis_field_templates (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  mapping jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.gis_field_templates is
  'Template field mapping import GIS (source field → GADE field) (§24).';

create or replace trigger gis_field_templates_set_updated_at
  before update on public.gis_field_templates
  for each row
  execute function public.set_updated_at();

-- RLS: template dipakai bersama tim internal (semua authenticated);
-- pembuat tercatat di created_by.
alter table public.gis_field_templates enable row level security;

drop policy if exists "gis_field_templates_select_authenticated" on public.gis_field_templates;
create policy "gis_field_templates_select_authenticated"
  on public.gis_field_templates
  for select
  to authenticated
  using (true);

drop policy if exists "gis_field_templates_insert_authenticated" on public.gis_field_templates;
create policy "gis_field_templates_insert_authenticated"
  on public.gis_field_templates
  for insert
  to authenticated
  with check (true);

drop policy if exists "gis_field_templates_delete_authenticated" on public.gis_field_templates;
create policy "gis_field_templates_delete_authenticated"
  on public.gis_field_templates
  for delete
  to authenticated
  using (true);
