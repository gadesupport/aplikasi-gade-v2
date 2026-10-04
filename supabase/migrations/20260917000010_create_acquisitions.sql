-- GadeSystem — migration: acquisitions (pembebasan bidang, AGENTS.md §10)
-- Relasi: land_parcels 1:N acquisitions (satu bidang dapat memiliki catatan
-- pembebasan lebih dari satu — mis. negosiasi ulang setelah BATAL).
-- Rekap per lokasi tersedia lewat view acquisition_location_recap.

create table if not exists public.acquisitions (
  id uuid primary key default gen_random_uuid(),
  bidang_id uuid not null references public.land_parcels (id) on delete cascade,
  tanggal_mulai date not null,
  harga_penawaran numeric(18, 2) check (harga_penawaran is null or harga_penawaran >= 0),
  harga_kesepakatan numeric(18, 2) check (harga_kesepakatan is null or harga_kesepakatan >= 0),
  luas_dibebaskan numeric(16, 2) check (luas_dibebaskan is null or luas_dibebaskan >= 0),
  uang_muka numeric(18, 2) check (uang_muka is null or uang_muka >= 0),
  pelunasan numeric(18, 2) check (pelunasan is null or pelunasan >= 0),
  tanggal_pelunasan date,
  pihak_terlibat text,
  catatan text,
  status_transaksi text not null default 'NEGOSIASI'
    check (status_transaksi in ('NEGOSIASI', 'SIAP_TRANSAKSI', 'TRANSAKSI', 'SELESAI', 'BATAL')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.acquisitions is
  'Proses pembebasan pada level bidang (AGENTS.md §10).';

create index if not exists acquisitions_bidang_idx on public.acquisitions (bidang_id);
create index if not exists acquisitions_status_idx on public.acquisitions (status_transaksi);
create index if not exists acquisitions_tanggal_mulai_idx on public.acquisitions (tanggal_mulai desc);

create or replace trigger acquisitions_set_updated_at
  before update on public.acquisitions
  for each row
  execute function public.set_updated_at();

-- RLS: alur kerja sehari-hari; hapus hanya ADMIN/SUPERADMIN.
alter table public.acquisitions enable row level security;

drop policy if exists "acquisitions_select_authenticated" on public.acquisitions;
create policy "acquisitions_select_authenticated"
  on public.acquisitions
  for select
  to authenticated
  using (true);

drop policy if exists "acquisitions_insert_authenticated" on public.acquisitions;
create policy "acquisitions_insert_authenticated"
  on public.acquisitions
  for insert
  to authenticated
  with check (true);

drop policy if exists "acquisitions_update_authenticated" on public.acquisitions;
create policy "acquisitions_update_authenticated"
  on public.acquisitions
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "acquisitions_delete_admin" on public.acquisitions;
create policy "acquisitions_delete_admin"
  on public.acquisitions
  for delete
  to authenticated
  using (public.is_admin());

-- ============================================================
-- Rekap pembebasan per lokasi (dihitung saat dibaca)
-- Totalan mengkecualikan BATAL; hitungan status mencakup semua.
-- ============================================================
create or replace view public.acquisition_location_recap
with (security_invoker = true) as
select
  p.lokasi_id as location_id,
  count(*) filter (where a.status_transaksi <> 'BATAL') as jumlah_aktif,
  count(distinct p.id) filter (where a.status_transaksi <> 'BATAL') as bidang_dibebaskan,
  count(*) filter (where a.status_transaksi = 'NEGOSIASI') as negosiasi,
  count(*) filter (where a.status_transaksi = 'SIAP_TRANSAKSI') as siap_transaksi,
  count(*) filter (where a.status_transaksi = 'TRANSAKSI') as transaksi,
  count(*) filter (where a.status_transaksi = 'SELESAI') as selesai,
  count(*) filter (where a.status_transaksi = 'BATAL') as batal,
  coalesce(sum(a.luas_dibebaskan) filter (where a.status_transaksi <> 'BATAL'), 0) as luas_dibebaskan_m2,
  coalesce(sum(a.harga_kesepakatan) filter (where a.status_transaksi <> 'BATAL'), 0) as total_harga_kesepakatan,
  coalesce(sum(a.uang_muka) filter (where a.status_transaksi <> 'BATAL'), 0) as total_uang_muka,
  coalesce(sum(a.pelunasan) filter (where a.status_transaksi <> 'BATAL'), 0) as total_pelunasan
from public.acquisitions a
join public.land_parcels p on p.id = a.bidang_id
group by p.lokasi_id;

grant select on public.acquisition_location_recap to authenticated;

comment on view public.acquisition_location_recap is
  'Rekap pembebasan per lokasi: jumlah per status, luas, dan totalan uang (non-BATAL) (AGENTS.md §10).';
