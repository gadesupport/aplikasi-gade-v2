-- GadeSystem — migration: surveys (AGENTS.md §8)
-- Survey pada LOKASI dan/atau BIDANG — minimal salah satu wajib terisi
-- (CHECK surveys_target_required). Koordinat GPS opsional; lat & lng harus
-- konsisten berpasangan (dua-duanya null atau dua-duanya terisi).
-- Upload foto belum dibuat (menyusul terpisah).

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  lokasi_id uuid references public.locations (id) on delete cascade,
  bidang_id uuid references public.land_parcels (id) on delete cascade,
  tanggal_survey date not null,
  surveyor text not null,
  hasil_survey text not null,
  catatan text,
  latitude double precision
    check (latitude is null or latitude between -90 and 90),
  longitude double precision
    check (longitude is null or longitude between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint surveys_target_required
    check (lokasi_id is not null or bidang_id is not null),
  constraint surveys_coords_pair
    check ((latitude is null) = (longitude is null))
);

comment on table public.surveys is
  'Hasil survey lokasi/bidang — minimal satu target terisi (AGENTS.md §8).';

create index if not exists surveys_lokasi_idx on public.surveys (lokasi_id);
create index if not exists surveys_bidang_idx on public.surveys (bidang_id);
create index if not exists surveys_tanggal_idx on public.surveys (tanggal_survey desc);
create index if not exists surveys_surveyor_idx on public.surveys (surveyor);

create or replace trigger surveys_set_updated_at
  before update on public.surveys
  for each row
  execute function public.set_updated_at();

-- RLS: data alur kerja harian surveyor — semua operasi untuk user terautentikasi.
alter table public.surveys enable row level security;

drop policy if exists "surveys_select_authenticated" on public.surveys;
create policy "surveys_select_authenticated"
  on public.surveys
  for select
  to authenticated
  using (true);

drop policy if exists "surveys_insert_authenticated" on public.surveys;
create policy "surveys_insert_authenticated"
  on public.surveys
  for insert
  to authenticated
  with check (true);

drop policy if exists "surveys_update_authenticated" on public.surveys;
create policy "surveys_update_authenticated"
  on public.surveys
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "surveys_delete_authenticated" on public.surveys;
create policy "surveys_delete_authenticated"
  on public.surveys
  for delete
  to authenticated
  using (true);
