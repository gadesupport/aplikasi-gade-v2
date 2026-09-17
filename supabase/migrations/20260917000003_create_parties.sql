-- GadeSystem — migration: parties (master pihak) + parcel_parties (relasi N:N)
-- Relasi: BIDANG N:N PIHAK melalui parcel_parties (AGENTS.md §6).

-- ============================================================
-- 1. Tabel parties (master pihak/pemilik)
-- ============================================================
create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  nik text,
  alamat text,
  nomor_telepon text,
  tipe_pihak text not null default 'PEMEGANG_HAK'
    check (tipe_pihak in ('PEMEGANG_HAK', 'AHLI_WARIS', 'KUASA', 'PENGUASA', 'PIHAK_LAIN')),
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.parties is 'Master pihak/pemilik — satu pihak dapat memiliki banyak bidang (AGENTS.md §6).';

create index if not exists parties_nama_idx on public.parties (nama);
create index if not exists parties_tipe_pihak_idx on public.parties (tipe_pihak);
-- NIK unik hanya bila diisi (partial unique index).
create unique index if not exists parties_nik_unique on public.parties (nik) where nik is not null;

create or replace trigger parties_set_updated_at
  before update on public.parties
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- 2. Tabel parcel_parties (relasi N:N bidang ↔ pihak)
-- ============================================================
create table if not exists public.parcel_parties (
  id uuid primary key default gen_random_uuid(),
  parcel_id uuid not null references public.land_parcels (id) on delete cascade,
  party_id uuid not null references public.parties (id) on delete cascade,
  peran text,
  keterangan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parcel_id, party_id)
);

comment on table public.parcel_parties is 'Relasi N:N bidang ↔ pihak; satu baris = satu pihak pada satu bidang (AGENTS.md §6).';
comment on constraint parcel_parties_parcel_id_party_id_key on public.parcel_parties is
  'Satu pihak hanya terhubung sekali per bidang.';

create index if not exists parcel_parties_parcel_idx on public.parcel_parties (parcel_id);
create index if not exists parcel_parties_party_idx on public.parcel_parties (party_id);

create or replace trigger parcel_parties_set_updated_at
  before update on public.parcel_parties
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- 3. RLS
-- ============================================================
-- parties: pola sama dengan master lain — hapus hanya ADMIN/SUPERADMIN.
alter table public.parties enable row level security;

drop policy if exists "parties_select_authenticated" on public.parties;
create policy "parties_select_authenticated"
  on public.parties
  for select
  to authenticated
  using (true);

drop policy if exists "parties_insert_authenticated" on public.parties;
create policy "parties_insert_authenticated"
  on public.parties
  for insert
  to authenticated
  with check (true);

drop policy if exists "parties_update_authenticated" on public.parties;
create policy "parties_update_authenticated"
  on public.parties
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "parties_delete_admin" on public.parties;
create policy "parties_delete_admin"
  on public.parties
  for delete
  to authenticated
  using (public.is_admin());

-- parcel_parties: kurasi relasi bagian alur kerja sehari-hari
-- (surveyor/legal menghubungkan pihak ke bidang) — semua operasi
-- untuk user terautentikasi. Cascade saat bidang/pihak dihapus
-- tetap berjalan (FK cascade tidak melalui RLS).
alter table public.parcel_parties enable row level security;

drop policy if exists "parcel_parties_select_authenticated" on public.parcel_parties;
create policy "parcel_parties_select_authenticated"
  on public.parcel_parties
  for select
  to authenticated
  using (true);

drop policy if exists "parcel_parties_insert_authenticated" on public.parcel_parties;
create policy "parcel_parties_insert_authenticated"
  on public.parcel_parties
  for insert
  to authenticated
  with check (true);

drop policy if exists "parcel_parties_update_authenticated" on public.parcel_parties;
create policy "parcel_parties_update_authenticated"
  on public.parcel_parties
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "parcel_parties_delete_authenticated" on public.parcel_parties;
create policy "parcel_parties_delete_authenticated"
  on public.parcel_parties
  for delete
  to authenticated
  using (true);
