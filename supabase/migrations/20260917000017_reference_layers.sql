-- GadeSystem — migration: reference layer untuk GIS import (AGENTS.md §18/§25)
-- Reference layer TIDAK otomatis menjadi bidang (§18). Geometry generik
-- (Point/Line/Polygon/Multi*) dengan SRID 4326 konsisten.

create table if not exists public.reference_layers (
  id uuid primary key default gen_random_uuid(),
  lokasi_id uuid references public.locations (id) on delete cascade,
  nama text not null,
  jenis text not null
    check (jenis in ('JALAN', 'SUNGAI', 'BATAS_DESA', 'MASTERPLAN', 'KONTUR', 'DATA_SURVEY', 'LAINNYA')),
  geometry geometry(Geometry, 4326) not null,
  properti jsonb,
  sumber text,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.reference_layers is
  'Layer referensi hasil import GIS — jalan, sungai, batas desa, dll. (§18).';

create index if not exists reference_layers_lokasi_idx on public.reference_layers (lokasi_id);
create index if not exists reference_layers_jenis_idx on public.reference_layers (jenis);
create index if not exists reference_layers_geometry_idx
  on public.reference_layers using gist (geometry);

create or replace trigger reference_layers_set_updated_at
  before update on public.reference_layers
  for each row
  execute function public.set_updated_at();

-- RLS: data referensi alur kerja — tambah/ubah untuk authenticated,
-- hapus hanya ADMIN/SUPERADMIN.
alter table public.reference_layers enable row level security;

drop policy if exists "reference_layers_select_authenticated" on public.reference_layers;
create policy "reference_layers_select_authenticated"
  on public.reference_layers
  for select
  to authenticated
  using (true);

drop policy if exists "reference_layers_insert_authenticated" on public.reference_layers;
create policy "reference_layers_insert_authenticated"
  on public.reference_layers
  for insert
  to authenticated
  with check (true);

drop policy if exists "reference_layers_update_authenticated" on public.reference_layers;
create policy "reference_layers_update_authenticated"
  on public.reference_layers
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "reference_layers_delete_admin" on public.reference_layers;
create policy "reference_layers_delete_admin"
  on public.reference_layers
  for delete
  to authenticated
  using (public.is_admin());
