-- GadeSystem — migration: archives (AGENTS.md §12)
-- Arsip mandiri yang dapat berkaitan dengan LOCATION / PARCEL / PROJECT /
-- GENERAL. Aturan relasi DITEGAKKAN di database (CHECK archives_relation_valid):
--   LOCATION → location_id wajib, dua FK lain null
--   PARCEL   → parcel_id wajib, dua FK lain null
--   PROJECT  → project_id wajib, dua FK lain null
--   GENERAL  → ketiga FK harus null
-- Kode format ARS-YYYY-NNN (regex). Dokumen digital (Supabase Storage)
-- menyusul pada modul terpisah (§13); serah terima pada §14.

create table if not exists public.archives (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique
    check (kode ~ '^ARS-[0-9]{4}-[0-9]{3}$'),
  nama_dokumen text not null,
  kategori text,
  jenis_dokumen text,
  nomor_dokumen text,
  tanggal_dokumen date,
  tipe_relasi text not null
    check (tipe_relasi in ('LOCATION', 'PARCEL', 'PROJECT', 'GENERAL')),
  location_id uuid references public.locations (id) on delete cascade,
  parcel_id uuid references public.land_parcels (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  gudang text,
  rak text,
  box text,
  folder text,
  status text not null default 'TERSEDIA'
    check (status in ('TERSEDIA', 'DIPINJAM', 'HILANG', 'RUSAK', 'DIARSIPKAN')),
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint archives_relation_valid check (
    (tipe_relasi = 'LOCATION' and location_id is not null and parcel_id is null and project_id is null)
    or (tipe_relasi = 'PARCEL' and parcel_id is not null and location_id is null and project_id is null)
    or (tipe_relasi = 'PROJECT' and project_id is not null and location_id is null and parcel_id is null)
    or (tipe_relasi = 'GENERAL' and location_id is null and parcel_id is null and project_id is null)
  )
);

comment on table public.archives is
  'Arsip fisik dengan relasi tepat-satu target atau GENERAL (AGENTS.md §12).';

create index if not exists archives_tipe_relasi_idx on public.archives (tipe_relasi);
create index if not exists archives_status_idx on public.archives (status);
create index if not exists archives_location_idx on public.archives (location_id);
create index if not exists archives_parcel_idx on public.archives (parcel_id);
create index if not exists archives_project_idx on public.archives (project_id);
create index if not exists archives_created_at_idx on public.archives (created_at desc);

create or replace trigger archives_set_updated_at
  before update on public.archives
  for each row
  execute function public.set_updated_at();

-- RLS: pola master — hapus hanya ADMIN/SUPERADMIN.
alter table public.archives enable row level security;

drop policy if exists "archives_select_authenticated" on public.archives;
create policy "archives_select_authenticated"
  on public.archives
  for select
  to authenticated
  using (true);

drop policy if exists "archives_insert_authenticated" on public.archives;
create policy "archives_insert_authenticated"
  on public.archives
  for insert
  to authenticated
  with check (true);

drop policy if exists "archives_update_authenticated" on public.archives;
create policy "archives_update_authenticated"
  on public.archives
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "archives_delete_admin" on public.archives;
create policy "archives_delete_admin"
  on public.archives
  for delete
  to authenticated
  using (public.is_admin());
