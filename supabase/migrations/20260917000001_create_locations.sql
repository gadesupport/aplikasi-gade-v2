-- GadeSystem — migration: locations (lokasi/areal) + index + RLS
-- Kolom geometry (Polygon, SRID 4326) disiapkan sebagai batas induk/areal;
-- polygon editor & validasi spatial menyusul pada modul Peta (AGENTS.md §17).

-- ============================================================
-- 1. Ekstensi PostGIS (dipasang di schema extensions — konvensi Supabase)
-- ============================================================
create extension if not exists postgis with schema extensions;

-- ============================================================
-- 2. Tabel locations
-- ============================================================
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique,
  nama text not null,
  alamat text,
  desa text,
  kecamatan text,
  kabupaten text,
  luas_target numeric(16, 2) check (luas_target is null or luas_target >= 0),
  luas_teridentifikasi numeric(16, 2) check (luas_teridentifikasi is null or luas_teridentifikasi >= 0),
  luas_deal numeric(16, 2) check (luas_deal is null or luas_deal >= 0),
  peruntukan text,
  kondisi_lahan text,
  kondisi_pasar text,
  catatan text,
  status text not null default 'SURVEY'
    check (status in ('SURVEY', 'PEMBAHASAN', 'PROSES_PEMBEBASAN', 'SELESAI', 'DITOLAK', 'DITUNDA')),
  geometry geometry(Polygon, 4326),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.locations is 'Lokasi/areal yang dianalisis atau dibebaskan (AGENTS.md §4.1).';

-- ============================================================
-- 3. Index (btree untuk filter/sort, GIST untuk spatial)
-- ============================================================
create index if not exists locations_status_idx on public.locations (status);
create index if not exists locations_desa_idx on public.locations (desa);
create index if not exists locations_kecamatan_idx on public.locations (kecamatan);
create index if not exists locations_kabupaten_idx on public.locations (kabupaten);
create index if not exists locations_created_at_idx on public.locations (created_at desc);
create index if not exists locations_geometry_idx on public.locations using gist (geometry);

create or replace trigger locations_set_updated_at
  before update on public.locations
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- 4. Helper: apakah pelaku ADMIN/SUPERADMIN
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('SUPERADMIN', 'ADMIN')
  )
$$;

-- ============================================================
-- 5. RLS locations
-- ============================================================
alter table public.locations enable row level security;

-- Baca: semua user terautentikasi.
drop policy if exists "locations_select_authenticated" on public.locations;
create policy "locations_select_authenticated"
  on public.locations
  for select
  to authenticated
  using (true);

-- Tambah: semua user terautentikasi (termasuk surveyor).
drop policy if exists "locations_insert_authenticated" on public.locations;
create policy "locations_insert_authenticated"
  on public.locations
  for insert
  to authenticated
  with check (true);

-- Ubah: semua user terautentikasi (perubahan status bagian dari alur kerja).
drop policy if exists "locations_update_authenticated" on public.locations;
create policy "locations_update_authenticated"
  on public.locations
  for update
  to authenticated
  using (true)
  with check (true);

-- Hapus: hanya ADMIN/SUPERADMIN (destruktif).
drop policy if exists "locations_delete_admin" on public.locations;
create policy "locations_delete_admin"
  on public.locations
  for delete
  to authenticated
  using (public.is_admin());
