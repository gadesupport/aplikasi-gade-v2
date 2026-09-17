-- GadeSystem — migration: land_parcels (bidang tanah) + FK + index + RLS
-- Relasi: locations 1:N land_parcels (AGENTS.md §5).
-- Kolom geometry (Polygon, SRID 4326) nullable sampai bidang dipetakan;
-- polygon editor & validasi spatial menyusul pada modul Peta (AGENTS.md §17).

-- ============================================================
-- 1. Tabel land_parcels
-- ============================================================
create table if not exists public.land_parcels (
  id uuid primary key default gen_random_uuid(),
  lokasi_id uuid not null references public.locations (id) on delete restrict,
  kode text not null unique,
  nomor_bidang text,
  luas numeric(16, 2) check (luas is null or luas >= 0),
  jenis_hak text,
  nomor_hak text,
  status_pembebasan text not null default 'TERIDENTIFIKASI'
    check (status_pembebasan in (
      'TERIDENTIFIKASI', 'SURVEY', 'LEGAL_CHECK', 'NEGOSIASI',
      'SIAP_TRANSAKSI', 'TRANSAKSI', 'SELESAI', 'DITOLAK', 'DITUNDA'
    )),
  harga_penawaran numeric(18, 2) check (harga_penawaran is null or harga_penawaran >= 0),
  harga_kesepakatan numeric(18, 2) check (harga_kesepakatan is null or harga_kesepakatan >= 0),
  tanggal_kesepakatan date,
  catatan text,
  geometry geometry(Polygon, 4326),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.land_parcels is 'Bidang tanah individual di dalam suatu lokasi (AGENTS.md §5).';
comment on constraint land_parcels_lokasi_id_fkey on public.land_parcels is
  'RESTRICT: lokasi tidak boleh terhapus selama masih memiliki bidang.';

create index if not exists land_parcels_lokasi_idx on public.land_parcels (lokasi_id);
create index if not exists land_parcels_status_idx on public.land_parcels (status_pembebasan);
create index if not exists land_parcels_nomor_hak_idx on public.land_parcels (nomor_hak);
create index if not exists land_parcels_created_at_idx on public.land_parcels (created_at desc);
create index if not exists land_parcels_geometry_idx on public.land_parcels using gist (geometry);

create or replace trigger land_parcels_set_updated_at
  before update on public.land_parcels
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- 2. RLS land_parcels (pola sama dengan locations)
-- ============================================================
alter table public.land_parcels enable row level security;

-- Baca: semua user terautentikasi.
drop policy if exists "land_parcels_select_authenticated" on public.land_parcels;
create policy "land_parcels_select_authenticated"
  on public.land_parcels
  for select
  to authenticated
  using (true);

-- Tambah: semua user terautentikasi (termasuk surveyor).
drop policy if exists "land_parcels_insert_authenticated" on public.land_parcels;
create policy "land_parcels_insert_authenticated"
  on public.land_parcels
  for insert
  to authenticated
  with check (true);

-- Ubah: semua user terautentikasi (perubahan status bagian dari alur kerja).
drop policy if exists "land_parcels_update_authenticated" on public.land_parcels;
create policy "land_parcels_update_authenticated"
  on public.land_parcels
  for update
  to authenticated
  using (true)
  with check (true);

-- Hapus: hanya ADMIN/SUPERADMIN (destruktif).
drop policy if exists "land_parcels_delete_admin" on public.land_parcels;
create policy "land_parcels_delete_admin"
  on public.land_parcels
  for delete
  to authenticated
  using (public.is_admin());
