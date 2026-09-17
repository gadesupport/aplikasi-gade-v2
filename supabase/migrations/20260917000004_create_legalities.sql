-- GadeSystem — migration: legalities (legalitas per bidang)
-- Relasi: BIDANG 1:N LEGALITAS; legalitas dapat terkait pihak nullable (AGENTS.md §7).

-- ============================================================
-- 1. Tabel legalities
-- ============================================================
create table if not exists public.legalities (
  id uuid primary key default gen_random_uuid(),
  bidang_id uuid not null references public.land_parcels (id) on delete cascade,
  pihak_id uuid references public.parties (id) on delete set null,
  jenis_dokumen text not null
    check (jenis_dokumen in (
      'SERTIFIKAT', 'SHM', 'SHGB', 'AJB', 'KTP', 'KK', 'PBB', 'SPPT',
      'GIRIK', 'LETTER_C', 'SURAT_WARIS', 'AKTA_WARIS', 'SURAT_KUASA', 'LAINNYA'
    )),
  nomor_dokumen text,
  tanggal_dokumen date,
  penerbit text,
  status text not null default 'BELUM_ADA'
    check (status in ('ADA', 'BELUM_ADA', 'PROSES', 'TIDAK_RELEVAN', 'PERLU_VERIFIKASI')),
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.legalities is 'Legalitas pada level bidang — satu bidang dapat memiliki banyak legalitas (AGENTS.md §7).';

create index if not exists legalities_bidang_idx on public.legalities (bidang_id);
create index if not exists legalities_pihak_idx on public.legalities (pihak_id);
create index if not exists legalities_status_idx on public.legalities (status);

create or replace trigger legalities_set_updated_at
  before update on public.legalities
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- 2. RLS legalities — data alur kerja level bidang:
--    semua operasi untuk user terautentikasi.
-- ============================================================
alter table public.legalities enable row level security;

drop policy if exists "legalities_select_authenticated" on public.legalities;
create policy "legalities_select_authenticated"
  on public.legalities
  for select
  to authenticated
  using (true);

drop policy if exists "legalities_insert_authenticated" on public.legalities;
create policy "legalities_insert_authenticated"
  on public.legalities
  for insert
  to authenticated
  with check (true);

drop policy if exists "legalities_update_authenticated" on public.legalities;
create policy "legalities_update_authenticated"
  on public.legalities
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "legalities_delete_authenticated" on public.legalities;
create policy "legalities_delete_authenticated"
  on public.legalities
  for delete
  to authenticated
  using (true);
