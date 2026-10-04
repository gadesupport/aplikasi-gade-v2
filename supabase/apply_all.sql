-- GadeSystem — migration: profiles + RLS
-- Terapkan via Supabase Dashboard (SQL Editor) atau Supabase CLI (supabase db push).
-- Password/identitas tetap dikelola Supabase Auth — tabel ini hanya profil (nama, role).

-- ============================================================
-- 1. Trigger updated_at generik (dipakai ulang tabel lain nanti)
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 2. Tabel profiles
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nama text not null default '',
  role text not null default 'ADMIN'
    check (role in ('SUPERADMIN', 'ADMIN', 'SURVEYOR', 'LEGAL')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Profil pengguna GadeSystem (1:1 dengan auth.users).';

create index if not exists profiles_role_idx on public.profiles (role);

create or replace trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- 3. Helper: apakah pelaku SUPERADMIN
--    (security definer → query internal tidak kena RLS → bebas rekursi policy)
-- ============================================================
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'SUPERADMIN'
  )
$$;

-- ============================================================
-- 4. Profil otomatis untuk setiap user baru (dashboard maupun signup)
--    User pertama = SUPERADMIN, selanjutnya ADMIN
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nama, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nama', split_part(coalesce(new.email, 'pengguna'), '@', 1)),
    case
      when not exists (select 1 from public.profiles) then 'SUPERADMIN'
      else 'ADMIN'
    end
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================
-- 5. RLS profiles
-- ============================================================
alter table public.profiles enable row level security;

-- Baca: semua user terautentikasi (nama/role dipakai UI).
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

-- Update baris sendiri (mis. ubah nama sendiri).
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Update semua baris khusus SUPERADMIN (kelola role user lain).
drop policy if exists "profiles_update_superadmin" on public.profiles;
create policy "profiles_update_superadmin"
  on public.profiles
  for update
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Tidak ada policy insert/delete:
-- - insert hanya lewat trigger handle_new_user (security definer)
-- - delete mengikuti auth.users (on delete cascade), oleh admin

-- ============================================================
-- 6. Guard: hanya SUPERADMIN yang boleh mengubah role via REST API
--    (akses admin tanpa JWT — service_role / SQL editor — tetap lolos)
-- ============================================================
create or replace function public.guard_profiles_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
    and auth.uid() is not null
    and not public.is_superadmin()
  then
    raise exception 'Hanya SUPERADMIN yang boleh mengubah role.';
  end if;
  return new;
end;
$$;

create or replace trigger profiles_guard_role
  before update on public.profiles
  for each row
  execute function public.guard_profiles_role();
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
-- GadeSystem — migration: penguat GIS (idempotent)
-- Memastikan ulang kolom geometry, SRID, spatial index, dan validitas untuk
-- locations & land_parcels. Aman dijalankan berulang (IF NOT EXISTS / drop+add).
--
-- Konsistensi SRID: SEMUA kolom geometry memakai SRID 4326 (WGS84) — standar
-- KML, OpenStreetMap, dan native Leaflet (AGENTS.md §17/§21/§27). SRID sudah
-- ditegakkan oleh tipe kolom geometry(Polygon, 4326); insert dengan SRID lain
-- otomatis ditolak database.
--
-- Kolom geometry TIDAK dipakai UI dulu — polygon editor menyusul (§17).

-- ============================================================
-- 1. Pastikan PostGIS aktif (no-op bila sudah terpasang di schema mana pun)
-- ============================================================
create extension if not exists postgis with schema extensions;

-- ============================================================
-- 2. Kolom geometry (Polygon, SRID 4326) — konsisten di kedua tabel
-- ============================================================
alter table public.locations
  add column if not exists geometry geometry(Polygon, 4326);

alter table public.land_parcels
  add column if not exists geometry geometry(Polygon, 4326);

-- ============================================================
-- 3. Spatial index GIST
-- ============================================================
create index if not exists locations_geometry_idx
  on public.locations using gist (geometry);

create index if not exists land_parcels_geometry_idx
  on public.land_parcels using gist (geometry);

-- ============================================================
-- 4. Guard validitas: tolak polygon self-intersecting / invalid
--    (server-side; ST_IsValid immutable sehingga sah untuk CHECK)
-- ============================================================
alter table public.locations
  drop constraint if exists locations_geometry_valid;

alter table public.locations
  add constraint locations_geometry_valid
  check (geometry is null or st_isvalid(geometry));

alter table public.land_parcels
  drop constraint if exists land_parcels_geometry_valid;

alter table public.land_parcels
  add constraint land_parcels_geometry_valid
  check (geometry is null or st_isvalid(geometry));
-- GadeSystem — migration: validasi spatial server-side untuk polygon bidang
-- RPC save_parcel_geometry: satu-satunya jalur resmi menyimpan polygon bidang
-- (AGENTS.md §17.5). Validasi ATOMIK di server:
--   1. ST_IsValid / anti self-intersection
--   2. child berada di dalam parent (ST_CoveredBy)
--   3. tidak overlap dengan bidang lain — shared boundary diperbolehkan
--      (toleransi luas intersection 0,01 m²)
-- Gagal validasi → EXCEPTION → transaksi dibatalkan → tidak tersimpan.
-- Function berjalan sebagai invoker (bukan security definer) sehingga RLS
-- land_parcels/locations tetap berlaku.

-- SQLSTATE kustom (muncul di error.code PostgREST):
--   GDE00 data polygon tidak terbaca / bukan polygon
--   GDE01 polygon invalid (self-intersecting / terbalik)
--   GDE02 keluar dari batas induk (parent)
--   GDE03 overlap dengan bidang lain
--   GDE04 batas induk belum digambar
--   GDE05 batas induk invalid

create or replace function public.save_parcel_geometry(p_parcel_id uuid, p_geojson jsonb)
returns void
language plpgsql
as $$
declare
  v_new geometry;
  v_lokasi_id uuid;
  v_parent geometry;
  v_conflict record;
  v_tolerance_m2 constant double precision := 0.01;
begin
  -- Hapus pemetaan: langsung set null (tanpa validasi polygon).
  if p_geojson is null then
    update public.land_parcels set geometry = null where id = p_parcel_id;
    if not found then
      raise exception 'Bidang tanah tidak ditemukan.'
        using errcode = 'P0002';
    end if;
    return;
  end if;

  begin
    v_new := st_setsrid(st_geomfromgeojson(p_geojson::text), 4326);
  exception when others then
    raise exception 'Data polygon tidak dapat dibaca. Gambar ulang polygon lalu simpan lagi.'
      using errcode = 'GDE00';
  end;

  if st_geometrytype(v_new) <> 'ST_Polygon' then
    raise exception 'Geometry harus berupa Polygon.'
      using errcode = 'GDE00';
  end if;

  -- 1 & 5. Valid + tidak self-intersect (ST_IsValid menangkap keduanya).
  if not st_isvalid(v_new) then
    raise exception
      'Polygon tidak valid: ada garis yang berpotongan (self-intersection). Perbaiki bentuk polygon lalu simpan lagi.'
      using errcode = 'GDE01';
  end if;

  select lokasi_id into v_lokasi_id
  from public.land_parcels
  where id = p_parcel_id;

  if v_lokasi_id is null then
    raise exception 'Bidang tanah tidak ditemukan.'
      using errcode = 'P0002';
  end if;

  select geometry into v_parent
  from public.locations
  where id = v_lokasi_id;

  if v_parent is null then
    raise exception
      'Batas lokasi induk belum digambar. Gambar batas lokasi terlebih dahulu sebelum memetakan bidang.'
      using errcode = 'GDE04';
  end if;

  if not st_isvalid(v_parent) then
    raise exception 'Batas lokasi induk tidak valid. Hubungi administrator.'
      using errcode = 'GDE05';
  end if;

  -- 2. Child harus berada di dalam parent (boundary boleh menempel).
  if not st_coveredby(v_new, v_parent) then
    raise exception
      'Polygon bidang keluar dari batas lokasi. Pastikan seluruh bidang berada di dalam batas induk.'
      using errcode = 'GDE02';
  end if;

  -- 3. Tidak boleh overlap dengan bidang lain di lokasi yang sama;
  --    4. shared boundary diperbolehkan (luas intersection ≤ toleransi).
  select p.id, p.kode,
         st_area(st_intersection(v_new, p.geometry)::geography) as overlap_m2
  into v_conflict
  from public.land_parcels p
  where p.lokasi_id = v_lokasi_id
    and p.id <> p_parcel_id
    and p.geometry is not null
    and st_intersects(v_new, p.geometry)
    and st_area(st_intersection(v_new, p.geometry)::geography) > v_tolerance_m2
  order by 3 desc
  limit 1;

  if found then
    raise exception
      'Polygon bidang overlap dengan bidang % (sekitar % m²). Bidang boleh berbatasan (shared boundary) tetapi tidak boleh bertumpuk.',
      v_conflict.kode, round(v_conflict.overlap_m2::numeric, 1)
      using errcode = 'GDE03';
  end if;

  update public.land_parcels
  set geometry = v_new
  where id = p_parcel_id;

  if not found then
    raise exception 'Bidang tanah tidak ditemukan.'
      using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.save_parcel_geometry(uuid, jsonb) is
  'Validasi spatial + simpan polygon bidang; menolak polygon invalid, di luar induk, atau overlap.';
-- GadeSystem — migration: perhitungan area & status pemetaan per lokasi
-- View location_area_stats (AGENTS.md §17.6), dihitung PostGIS saat dibaca:
--   luas_parent_m2         luas batas induk (ST_Area geography, m²)
--   luas_bidang_bruto_m2   Σ luas tiap polygon bidang (overlap dihitung ganda)
--   luas_bidang_netto_m2   luas ST_Union seluruh bidang (overlap dihitung sekali)
--   sisa_luas_m2           parent − netto (min 0)
--   coverage_percent       netto ÷ parent × 100 (dikunci maks 100)
--   status_pemetaan        GEOMETRY_INVALID > OVERLAP > TERPETAK_PENUH > BELUM_PENUH
--
-- Aturan status:
--   GEOMETRY_INVALID  parent/ada bidang invalid (defensif; CHECK sudah mencegah)
--   OVERLAP           bruto > netto + 0,01 m² (ada bidang bertumpuk)
--   TERPETAK_PENUH    sisa ≤ 1 m²
--   BELUM_PENUH       lainnya (termasuk batas induk belum digambar)
--
-- security_invoker → view mengeksekusi sebagai pemanggil sehingga RLS
-- locations/land_parcels tetap berlaku.

create or replace view public.location_area_stats
with (security_invoker = true) as
select
  l.id as location_id,
  c.luas_parent_m2,
  c.luas_bidang_bruto_m2,
  c.luas_bidang_netto_m2,
  c.sisa_luas_m2,
  c.coverage_percent,
  c.bidang_terpetakan,
  c.bidang_total,
  c.status_pemetaan
from public.locations l
cross join lateral (
  select
    base.*,
    case
      when base.luas_parent_m2 is null then null
      else least(round(((base.luas_bidang_netto_m2 / base.luas_parent_m2) * 100)::numeric, 2), 100)
    end as coverage_percent,
    case
      when base.invalid_geometry then 'GEOMETRY_INVALID'
      when base.luas_parent_m2 is null then 'BELUM_PENUH'
      when base.luas_bidang_bruto_m2 > base.luas_bidang_netto_m2 + 0.01 then 'OVERLAP'
      when base.luas_bidang_netto_m2 >= base.luas_parent_m2 - 1 then 'TERPETAK_PENUH'
      else 'BELUM_PENUH'
    end as status_pemetaan
  from (
    select
      st_area(l.geometry::geography) as luas_parent_m2,
      agg.bidang_terpetakan,
      agg.bidang_total,
      coalesce(agg.luas_bidang_bruto_m2, 0) as luas_bidang_bruto_m2,
      coalesce(agg.luas_bidang_netto_m2, 0) as luas_bidang_netto_m2,
      case
        when l.geometry is null then null
        else greatest(st_area(l.geometry::geography) - coalesce(agg.luas_bidang_netto_m2, 0), 0)
      end as sisa_luas_m2,
      (
        (l.geometry is not null and not st_isvalid(l.geometry))
        or coalesce(agg.any_invalid_geometry, false)
      ) as invalid_geometry
    from (
      select
        count(p.geometry) as bidang_terpetakan,
        count(*) as bidang_total,
        sum(st_area(p.geometry::geography)) as luas_bidang_bruto_m2,
        st_area(st_union(p.geometry)::geography) as luas_bidang_netto_m2,
        bool_or(not st_isvalid(p.geometry)) as any_invalid_geometry
      from public.land_parcels p
      where p.lokasi_id = l.id
    ) agg
  ) base
) c;

grant select on public.location_area_stats to authenticated;

comment on view public.location_area_stats is
  'Statistik pemetaan per lokasi: luas parent/bidang, sisa, coverage, status (AGENTS.md §17.6).';
-- GadeSystem — migration: pencarian terdekat (AGENTS.md §17.7)
-- Dua RPC read-only: bidang terdekat & lokasi terdekat dari titik
-- (lat/lng WGS84), jarak dalam METER (ST_Distance pada cast ::geography).
--
-- Urutan terdekat memakai KNN operator `<->` pada kolom geometry →
-- dipakai spatial index GIST (locations_geometry_idx / land_parcels_geometry_idx,
-- migration 000005). Jarak tampilan tetap dihitung eksak via geography.
--
-- Function berjalan sebagai invoker (bukan security definer) sehingga
-- RLS locations/land_parcels tetap berlaku. Limit dibatasi 1–50.

create or replace function public.find_nearest_parcels(
  p_lat double precision,
  p_lng double precision,
  p_limit integer default 5
)
returns table (
  id uuid,
  kode text,
  nomor_bidang text,
  jenis_hak text,
  luas numeric,
  lokasi_id uuid,
  lokasi_kode text,
  lokasi_nama text,
  jarak_m double precision
)
language sql
stable
as $$
  select
    p.id,
    p.kode,
    p.nomor_bidang,
    p.jenis_hak,
    p.luas,
    l.id,
    l.kode,
    l.nama,
    st_distance(
      p.geometry::geography,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    )
  from public.land_parcels p
  join public.locations l on l.id = p.lokasi_id
  where p.geometry is not null
  order by p.geometry <-> st_setsrid(st_makepoint(p_lng, p_lat), 4326)
  limit least(greatest(coalesce(p_limit, 5), 1), 50)
$$;

create or replace function public.find_nearest_locations(
  p_lat double precision,
  p_lng double precision,
  p_limit integer default 5
)
returns table (
  id uuid,
  kode text,
  nama text,
  jarak_m double precision
)
language sql
stable
as $$
  select
    l.id,
    l.kode,
    l.nama,
    st_distance(
      l.geometry::geography,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    )
  from public.locations l
  where l.geometry is not null
  order by l.geometry <-> st_setsrid(st_makepoint(p_lng, p_lat), 4326)
  limit least(greatest(coalesce(p_limit, 5), 1), 50)
$$;

comment on function public.find_nearest_parcels(double precision, double precision, integer) is
  'Bidang terdekat dari titik (KNN via GIST), jarak meter geography (§17.7).';
comment on function public.find_nearest_locations(double precision, double precision, integer) is
  'Lokasi terdekat dari titik (KNN via GIST), jarak meter geography (§17.7).';
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
-- GadeSystem — migration: projects (AGENTS.md §11)
-- Project entitas MANDIRI (tidak wajib berhubungan dengan bidang/lokasi):
-- untuk legal project, izin, dokumen project, dan arsip project.
-- Kolom "lokasi" adalah teks alamat lokasi project (bukan FK ke locations).
--
-- Kode format PRJ-YYYY-NNN ditegakkan regex di database DAN service.
-- Status tidak dispesifikkan AGENTS.md §11 → set umum: PERENCANAAN,
-- BERJALAN, SELESAI, DIBATALKAN (ubah via migration bila berbeda kebutuhan).

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique
    check (kode ~ '^PRJ-[0-9]{4}-[0-9]{3}$'),
  nama text not null,
  lokasi text,
  desa text,
  kecamatan text,
  kabupaten text,
  status text not null default 'PERENCANAAN'
    check (status in ('PERENCANAAN', 'BERJALAN', 'SELESAI', 'DIBATALKAN')),
  keterangan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.projects is
  'Project mandiri untuk legal project, izin, dan arsip project (AGENTS.md §11).';

create index if not exists projects_status_idx on public.projects (status);
create index if not exists projects_kabupaten_idx on public.projects (kabupaten);
create index if not exists projects_created_at_idx on public.projects (created_at desc);

create or replace trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute function public.set_updated_at();

-- RLS: pola master data — baca/tulis untuk semua user terautentikasi,
-- hapus hanya ADMIN/SUPERADMIN.
alter table public.projects enable row level security;

drop policy if exists "projects_select_authenticated" on public.projects;
create policy "projects_select_authenticated"
  on public.projects
  for select
  to authenticated
  using (true);

drop policy if exists "projects_insert_authenticated" on public.projects;
create policy "projects_insert_authenticated"
  on public.projects
  for insert
  to authenticated
  with check (true);

drop policy if exists "projects_update_authenticated" on public.projects;
create policy "projects_update_authenticated"
  on public.projects
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "projects_delete_admin" on public.projects;
create policy "projects_delete_admin"
  on public.projects
  for delete
  to authenticated
  using (public.is_admin());
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
-- GadeSystem — migration: dokumen digital arsip (AGENTS.md §13)
-- Bucket privat Supabase Storage + tabel metadata archive_documents.
-- File TIDAK disimpan sebagai base64 di database (§13) — hanya metadata;
-- file fisik ada di Storage private bucket "archive-documents".

-- Batas 20 MB = 20_971_520 byte (sinkron dengan documentService).
-- Ekstensi diizinkan: pdf, jpg, jpeg, png (sinkron dengan service).

-- ============================================================
-- 1. Private bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('archive-documents', 'archive-documents', false)
on conflict (id) do nothing;

-- ============================================================
-- 2. Storage policies (RLS storage.objects) — bucket privat:
--    hanya user terautentikasi; insert divalidasi ekstensi + ukuran.
-- ============================================================
drop policy if exists "archive_documents_storage_select" on storage.objects;
create policy "archive_documents_storage_select"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'archive-documents');

drop policy if exists "archive_documents_storage_insert" on storage.objects;
create policy "archive_documents_storage_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'archive-documents'
    and ((metadata ->> 'size')::bigint) <= 20971520
    and storage.extension(name) in ('pdf', 'jpg', 'jpeg', 'png')
  );

drop policy if exists "archive_documents_storage_delete" on storage.objects;
create policy "archive_documents_storage_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'archive-documents');

-- ============================================================
-- 3. Tabel metadata
-- ============================================================
create table if not exists public.archive_documents (
  id uuid primary key default gen_random_uuid(),
  archive_id uuid not null references public.archives (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text not null
    check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size bigint not null
    check (file_size > 0 and file_size <= 20971520),
  uploaded_by uuid references auth.users (id) on delete set null,
  uploaded_at timestamptz not null default now()
);

comment on table public.archive_documents is
  'Metadata dokumen digital arsip — file tersimpan di Storage bucket privat (AGENTS.md §13).';

create index if not exists archive_documents_archive_idx on public.archive_documents (archive_id);
create index if not exists archive_documents_uploaded_at_idx on public.archive_documents (uploaded_at desc);

-- RLS: dokumen bagian alur kerja arsip — baca/tambah/hapus untuk user
-- terautentikasi (selaras storage policies).
alter table public.archive_documents enable row level security;

drop policy if exists "archive_documents_select_authenticated" on public.archive_documents;
create policy "archive_documents_select_authenticated"
  on public.archive_documents
  for select
  to authenticated
  using (true);

drop policy if exists "archive_documents_insert_authenticated" on public.archive_documents;
create policy "archive_documents_insert_authenticated"
  on public.archive_documents
  for insert
  to authenticated
  with check (true);

drop policy if exists "archive_documents_delete_authenticated" on public.archive_documents;
create policy "archive_documents_delete_authenticated"
  on public.archive_documents
  for delete
  to authenticated
  using (true);
-- GadeSystem — migration: serah terima arsip (AGENTS.md §14)
-- Histori PERMANEN: hanya select + insert melalui API (RLS tanpa policy
-- update/delete) — koreksi hanya lewat SQL editor oleh admin.
--
-- Aturan status (ditegakkan RPC create_handover, atomik):
--   BERKAS_KELUAR  → arsip.status = DIPINJAM
--   BERKAS_KEMBALI → arsip.status = TERSEDIA
--   BERKAS_MASUK   → catatan saja, status tidak berubah
-- Nomor dibuat otomatis server-side (ST-YYYYMMDDHH24MISS-NNN).

create table if not exists public.handovers (
  id uuid primary key default gen_random_uuid(),
  nomor text not null unique,
  archive_id uuid not null references public.archives (id) on delete cascade,
  tanggal date not null,
  jenis text not null
    check (jenis in ('BERKAS_MASUK', 'BERKAS_KELUAR', 'BERKAS_KEMBALI')),
  dari text not null,
  kepada text not null,
  keperluan text,
  catatan text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.handovers is
  'Histori permanen serah terima arsip (AGENTS.md §14) — tidak dapat diedit/dihapus via API.';

create index if not exists handovers_archive_idx on public.handovers (archive_id);
create index if not exists handovers_jenis_idx on public.handovers (jenis);
create index if not exists handovers_created_at_idx on public.handovers (created_at desc);

-- RLS: histori permanen — hanya baca & tulis; TANPA policy update/delete.
alter table public.handovers enable row level security;

drop policy if exists "handovers_select_authenticated" on public.handovers;
create policy "handovers_select_authenticated"
  on public.handovers
  for select
  to authenticated
  using (true);

drop policy if exists "handovers_insert_authenticated" on public.handovers;
create policy "handovers_insert_authenticated"
  on public.handovers
  for insert
  to authenticated
  with check (true);

-- ============================================================
-- RPC create_handover: atomik — insert histori + ubah status arsip.
-- Invoker → RLS handovers/archives tetap berlaku.
-- ============================================================
create or replace function public.create_handover(
  p_archive_id uuid,
  p_jenis text,
  p_tanggal date,
  p_dari text,
  p_kepada text,
  p_keperluan text,
  p_catatan text
)
returns public.handovers
language plpgsql
as $$
declare
  v_row public.handovers;
begin
  if p_jenis not in ('BERKAS_MASUK', 'BERKAS_KELUAR', 'BERKAS_KEMBALI') then
    raise exception 'Jenis serah terima tidak dikenal.'
      using errcode = 'GDE10';
  end if;
  if coalesce(trim(p_dari), '') = '' or coalesce(trim(p_kepada), '') = '' then
    raise exception 'Kolom Dari dan Kepada wajib diisi.'
      using errcode = 'GDE11';
  end if;

  insert into public.handovers (
    nomor, archive_id, tanggal, jenis, dari, kepada, keperluan, catatan, created_by
  )
  values (
    'ST-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') || '-'
      || lpad((floor(random() * 1000))::int::text, 3, '0'),
    p_archive_id,
    coalesce(p_tanggal, current_date),
    p_jenis,
    trim(p_dari),
    trim(p_kepada),
    nullif(trim(p_keperluan), ''),
    nullif(trim(p_catatan), ''),
    auth.uid()
  )
  returning * into v_row;

  if p_jenis = 'BERKAS_KELUAR' then
    update public.archives set status = 'DIPINJAM' where id = p_archive_id;
  elsif p_jenis = 'BERKAS_KEMBALI' then
    update public.archives set status = 'TERSEDIA' where id = p_archive_id;
  end if;
  -- BERKAS_MASUK: hanya catat histori, status arsip tidak berubah.

  return v_row;
end;
$$;

comment on function public.create_handover(uuid, text, date, text, text, text, text) is
  'Catat serah terima atomik: insert histori + update status arsip (KELUAR→DIPINJAM, KEMBALI→TERSEDIA) (§14).';
-- GadeSystem — migration: validasi geometry terpisah untuk GIS import (§25)
-- Refactor dari save_parcel_geometry (000006): logika validasi dipindah ke
-- assert_parcel_geometry sehingga bisa dipakai dua jalur:
--   validate_parcel_geometry(lokasi_id, geojson)     → hanya validasi (import
--     GIS memanggil ini SEBELUM insert — "jangan insert sebelum validasi")
--   save_parcel_geometry(parcel_id, geojson)         → validasi + simpan
-- Pesan & errcode identik dengan 000006 (GDE00–GDE05).

create or replace function public.assert_parcel_geometry(
  p_lokasi_id uuid,
  p_exclude_parcel_id uuid,
  p_new geometry
)
returns void
language plpgsql
as $$
declare
  v_parent geometry;
  v_conflict record;
  v_tolerance_m2 constant double precision := 0.01;
begin
  if st_geometrytype(p_new) <> 'ST_Polygon' then
    raise exception 'Geometry harus berupa Polygon.' using errcode = 'GDE00';
  end if;

  if not st_isvalid(p_new) then
    raise exception
      'Polygon tidak valid: ada garis yang berpotongan (self-intersection). Perbaiki bentuk polygon lalu simpan lagi.'
      using errcode = 'GDE01';
  end if;

  select geometry into v_parent from public.locations where id = p_lokasi_id;

  if v_parent is null then
    raise exception
      'Batas lokasi induk belum digambar. Gambar batas lokasi terlebih dahulu sebelum memetakan bidang.'
      using errcode = 'GDE04';
  end if;

  if not st_isvalid(v_parent) then
    raise exception 'Batas lokasi induk tidak valid. Hubungi administrator.'
      using errcode = 'GDE05';
  end if;

  if not st_coveredby(p_new, v_parent) then
    raise exception
      'Polygon bidang keluar dari batas lokasi. Pastikan seluruh bidang berada di dalam batas induk.'
      using errcode = 'GDE02';
  end if;

  select p.id, p.kode,
         st_area(st_intersection(p_new, p.geometry)::geography) as overlap_m2
  into v_conflict
  from public.land_parcels p
  where p.lokasi_id = p_lokasi_id
    and p.id is distinct from p_exclude_parcel_id
    and p.geometry is not null
    and st_intersects(p_new, p.geometry)
    and st_area(st_intersection(p_new, p.geometry)::geography) > v_tolerance_m2
  order by 3 desc
  limit 1;

  if found then
    raise exception
      'Polygon bidang overlap dengan bidang % (sekitar % m²). Bidang boleh berbatasan (shared boundary) tetapi tidak boleh bertumpuk.',
      v_conflict.kode, round(v_conflict.overlap_m2::numeric, 1)
      using errcode = 'GDE03';
  end if;
end;
$$;

-- Validasi tanpa menyimpan — dipakai GIS import sebelum insert (§25).
create or replace function public.validate_parcel_geometry(
  p_lokasi_id uuid,
  p_geojson jsonb
)
returns void
language plpgsql
as $$
declare
  v_new geometry;
begin
  begin
    v_new := st_setsrid(st_geomfromgeojson(p_geojson::text), 4326);
  exception when others then
    raise exception 'Data polygon tidak dapat dibaca. Gambar ulang polygon lalu simpan lagi.'
      using errcode = 'GDE00';
  end;
  perform public.assert_parcel_geometry(p_lokasi_id, null, v_new);
end;
$$;

-- save_parcel_geometry kini memanggil asersi yang sama (perilaku tak berubah).
create or replace function public.save_parcel_geometry(p_parcel_id uuid, p_geojson jsonb)
returns void
language plpgsql
as $$
declare
  v_new geometry;
  v_lokasi_id uuid;
begin
  if p_geojson is null then
    update public.land_parcels set geometry = null where id = p_parcel_id;
    if not found then
      raise exception 'Bidang tanah tidak ditemukan.' using errcode = 'P0002';
    end if;
    return;
  end if;

  begin
    v_new := st_setsrid(st_geomfromgeojson(p_geojson::text), 4326);
  exception when others then
    raise exception 'Data polygon tidak dapat dibaca. Gambar ulang polygon lalu simpan lagi.'
      using errcode = 'GDE00';
  end;

  select lokasi_id into v_lokasi_id from public.land_parcels where id = p_parcel_id;
  if v_lokasi_id is null then
    raise exception 'Bidang tanah tidak ditemukan.' using errcode = 'P0002';
  end if;

  perform public.assert_parcel_geometry(v_lokasi_id, p_parcel_id, v_new);

  update public.land_parcels set geometry = v_new where id = p_parcel_id;
  if not found then
    raise exception 'Bidang tanah tidak ditemukan.' using errcode = 'P0002';
  end if;
end;
$$;
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
-- GadeSystem — migration: statistik dashboard (AGENTS.md §30)
-- Satu RPC mengembalikan seluruh angka dashboard sebagai jsonb (satu call).
-- Invoker → RLS semua tabel tetap berlaku. Read-only (stable).

create or replace function public.dashboard_stats()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'lokasi', jsonb_build_object(
      'total', (select count(*) from public.locations),
      'survey', (select count(*) from public.locations where status = 'SURVEY'),
      'pembahasan', (select count(*) from public.locations where status = 'PEMBAHASAN'),
      'proses_pembebasan', (select count(*) from public.locations where status = 'PROSES_PEMBEBASAN'),
      'selesai', (select count(*) from public.locations where status = 'SELESAI'),
      'ditolak', (select count(*) from public.locations where status = 'DITOLAK'),
      'ditunda', (select count(*) from public.locations where status = 'DITUNDA')
    ),
    'bidang', jsonb_build_object(
      'total', (select count(*) from public.land_parcels),
      'teridentifikasi', (select count(*) from public.land_parcels where status_pembebasan = 'TERIDENTIFIKASI'),
      'survey', (select count(*) from public.land_parcels where status_pembebasan = 'SURVEY'),
      'legal_check', (select count(*) from public.land_parcels where status_pembebasan = 'LEGAL_CHECK'),
      'negosiasi', (select count(*) from public.land_parcels where status_pembebasan = 'NEGOSIASI'),
      'siap_transaksi', (select count(*) from public.land_parcels where status_pembebasan = 'SIAP_TRANSAKSI'),
      'transaksi', (select count(*) from public.land_parcels where status_pembebasan = 'TRANSAKSI'),
      'selesai', (select count(*) from public.land_parcels where status_pembebasan = 'SELESAI'),
      'ditolak', (select count(*) from public.land_parcels where status_pembebasan = 'DITOLAK'),
      'ditunda', (select count(*) from public.land_parcels where status_pembebasan = 'DITUNDA')
    ),
    'pihak', jsonb_build_object(
      'total', (select count(*) from public.parties)
    ),
    'legalitas', jsonb_build_object(
      'total', (select count(*) from public.legalities),
      'ada', (select count(*) from public.legalities where status = 'ADA'),
      'belum_ada', (select count(*) from public.legalities where status = 'BELUM_ADA'),
      'proses', (select count(*) from public.legalities where status = 'PROSES'),
      'tidak_relevan', (select count(*) from public.legalities where status = 'TIDAK_RELEVAN'),
      'perlu_verifikasi', (select count(*) from public.legalities where status = 'PERLU_VERIFIKASI')
    ),
    'luas', jsonb_build_object(
      'target', (select coalesce(sum(luas_target), 0) from public.locations),
      'teridentifikasi', (select coalesce(sum(luas_teridentifikasi), 0) from public.locations),
      'deal', (select coalesce(sum(luas_deal), 0) from public.locations)
    ),
    'arsip', jsonb_build_object(
      'total', (select count(*) from public.archives),
      'tersedia', (select count(*) from public.archives where status = 'TERSEDIA'),
      'dipinjam', (select count(*) from public.archives where status = 'DIPINJAM'),
      'hilang', (select count(*) from public.archives where status = 'HILANG'),
      'rusak', (select count(*) from public.archives where status = 'RUSAK'),
      'diarsipkan', (select count(*) from public.archives where status = 'DIARSIPKAN'),
      'dokumen_digital', (select count(*) from public.archive_documents)
    ),
    'gis', jsonb_build_object(
      'lokasi_geometry', (select count(*) from public.locations where geometry is not null),
      'bidang_geometry', (select count(*) from public.land_parcels where geometry is not null),
      'geometry_invalid',
        (select count(*) from public.locations where geometry is not null and not st_isvalid(geometry))
        + (select count(*) from public.land_parcels where geometry is not null and not st_isvalid(geometry)),
      'overlap', (select count(*) from public.location_area_stats where status_pemetaan = 'OVERLAP'),
      'luas_parent_m2', (select coalesce(sum(luas_parent_m2), 0) from public.location_area_stats),
      'luas_terpetakan_m2', (select coalesce(sum(luas_bidang_netto_m2), 0) from public.location_area_stats),
      'coverage_percent', (
        select case
          when coalesce(sum(luas_parent_m2), 0) = 0 then null
          else least(round(((sum(luas_bidang_netto_m2) / sum(luas_parent_m2)) * 100)::numeric, 1), 100)
        end
        from public.location_area_stats where luas_parent_m2 is not null
      )
    )
  )
$$;

comment on function public.dashboard_stats() is
  'Statistik dashboard lengkap dalam satu jsonb (AGENTS.md §30).';
-- GadeSystem — migration: audit log (AGENTS.md §16)
-- Append-only: insert oleh user terautentikasi (via service layer),
-- SELECT hanya untuk SUPERADMIN, TANPA update/delete (permanen).
-- user_id terisi otomatis dari sesi (DEFAULT auth.uid()).

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete set null,
  action text not null
    check (action in (
      'LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'UPLOAD', 'DOWNLOAD',
      'HANDOVER', 'STATUS_CHANGE', 'GIS_IMPORT', 'GIS_EXPORT', 'GEOMETRY_CHANGE'
    )),
  entity text not null,
  entity_id text,
  description text,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is
  'Audit log append-only (§16) — tulis oleh authenticated, baca hanya SUPERADMIN.';

create index if not exists audit_logs_user_idx on public.audit_logs (user_id);
create index if not exists audit_logs_action_idx on public.audit_logs (action);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- RLS: permanen — hanya baca (SUPERADMIN) & tulis (authenticated).
alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_insert_authenticated" on public.audit_logs;
create policy "audit_logs_insert_authenticated"
  on public.audit_logs
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "audit_logs_select_superadmin" on public.audit_logs;
create policy "audit_logs_select_superadmin"
  on public.audit_logs
  for select
  to authenticated
  using (public.is_superadmin());

-- Tidak ada policy update/delete → tidak dapat diubah/dihapus via API.
-- GadeSystem — migration: hardening geometry access (hasil security audit)
-- Sebelumnya: land_parcels.geometry masih bisa ditulis langsung via PostgREST
-- (bypass RPC save_parcel_geometry yang memvalidasi inside-parent/overlap).
-- Sekarang: geometry bidang HANYA boleh ditulis melalui RPC — ditandai
-- dengan GUC lokal 'app.gis_rpc' yang diset save_parcel_geometry.

create or replace function public.save_parcel_geometry(p_parcel_id uuid, p_geojson jsonb)
returns void
language plpgsql
as $$
declare
  v_new geometry;
  v_lokasi_id uuid;
begin
  if p_geojson is null then
    update public.land_parcels set geometry = null where id = p_parcel_id;
    if not found then
      raise exception 'Bidang tanah tidak ditemukan.' using errcode = 'P0002';
    end if;
    return;
  end if;

  begin
    v_new := st_setsrid(st_geomfromgeojson(p_geojson::text), 4326);
  exception when others then
    raise exception 'Data polygon tidak dapat dibaca. Gambar ulang polygon lalu simpan lagi.'
      using errcode = 'GDE00';
  end;

  select lokasi_id into v_lokasi_id from public.land_parcels where id = p_parcel_id;
  if v_lokasi_id is null then
    raise exception 'Bidang tanah tidak ditemukan.' using errcode = 'P0002';
  end if;

  perform public.assert_parcel_geometry(v_lokasi_id, p_parcel_id, v_new);

  -- Tandai transaksi ini sebagai jalur RPC resmi (trigger geometry
  -- land_parcels memeriksa penanda ini).
  perform set_config('app.gis_rpc', 'true', true);

  update public.land_parcels set geometry = v_new where id = p_parcel_id;
  if not found then
    raise exception 'Bidang tanah tidak ditemukan.' using errcode = 'P0002';
  end if;
end;
$$;

-- Trigger penjaga: geometry bidang hanya boleh ditulis via RPC.
create or replace function public.guard_parcel_geometry()
returns trigger
language plpgsql
as $$
begin
  if new.geometry is not null
    and coalesce(current_setting('app.gis_rpc', true), '') <> 'true'
  then
    raise exception
      'Geometry bidang harus disimpan melalui proses pemetaan dengan validasi spatial (RPC save_parcel_geometry).'
      using errcode = 'GDE06';
  end if;
  return new;
end;
$$;

drop trigger if exists land_parcels_guard_geometry on public.land_parcels;
create trigger land_parcels_guard_geometry
  before insert or update of geometry on public.land_parcels
  for each row
  execute function public.guard_parcel_geometry();
-- GadeSystem — migration: pembahasan (AGENTS.md §9)
-- Pembahasan terkait LOKASI dan/atau BIDANG (minimal satu — CHECK).
-- Simpan histori: satu baris per pembahasan; target 1:N pembahasan.
-- Efek keputusan (ditegakkan RPC create/update, atomik):
--   TIDAK_LAYAK   → status target menjadi DITOLAK
--   PERLU_KAJIAN  → status target menjadi DITUNDA
--   LAYAK         → tidak mengubah status

create table if not exists public.discussions (
  id uuid primary key default gen_random_uuid(),
  lokasi_id uuid references public.locations (id) on delete cascade,
  bidang_id uuid references public.land_parcels (id) on delete cascade,
  tanggal date not null,
  peserta text not null,
  hasil text not null,
  keputusan text not null
    check (keputusan in ('LAYAK', 'PERLU_KAJIAN', 'TIDAK_LAYAK')),
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint discussions_target_required
    check (lokasi_id is not null or bidang_id is not null)
);

comment on table public.discussions is
  'Pembahasan lokasi/bidang + keputusan; efek status via RPC (§9).';

create index if not exists discussions_lokasi_idx on public.discussions (lokasi_id);
create index if not exists discussions_bidang_idx on public.discussions (bidang_id);
create index if not exists discussions_tanggal_idx on public.discussions (tanggal desc);
create index if not exists discussions_keputusan_idx on public.discussions (keputusan);

create or replace trigger discussions_set_updated_at
  before update on public.discussions
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- Efek keputusan → status target (dipanggil RPC create/update)
-- ============================================================
create or replace function public.apply_discussion_decision(
  p_lokasi_id uuid,
  p_bidang_id uuid,
  p_keputusan text
)
returns void
language plpgsql
as $$
begin
  if p_keputusan not in ('TIDAK_LAYAK', 'PERLU_KAJIAN') then
    return; -- LAYAK: tidak mengubah status
  end if;
  if p_lokasi_id is not null then
    update public.locations
    set status = case when p_keputusan = 'TIDAK_LAYAK' then 'DITOLAK' else 'DITUNDA' end
    where id = p_lokasi_id;
  elsif p_bidang_id is not null then
    update public.land_parcels
    set status_pembebasan = case when p_keputusan = 'TIDAK_LAYAK' then 'DITOLAK' else 'DITUNDA' end
    where id = p_bidang_id;
  end if;
end;
$$;

-- ============================================================
-- RPC create/update pembahasan (atomik + efek status).
-- Invoker → RLS tetap berlaku. SQLSTATE kustom:
--   GDE12 target tidak valid / tidak ditemukan
--   GDE13 keputusan tidak dikenal
-- ============================================================
create or replace function public.create_pembahasan(
  p_lokasi_id uuid,
  p_bidang_id uuid,
  p_tanggal date,
  p_peserta text,
  p_hasil text,
  p_keputusan text,
  p_catatan text
)
returns public.discussions
language plpgsql
as $$
declare
  v_row public.discussions;
begin
  if p_keputusan not in ('LAYAK', 'PERLU_KAJIAN', 'TIDAK_LAYAK') then
    raise exception 'Keputusan tidak dikenal.' using errcode = 'GDE13';
  end if;
  if (p_lokasi_id is null) = (p_bidang_id is null) then
    raise exception 'Pilih salah satu target: lokasi ATAU bidang.'
      using errcode = 'GDE12';
  end if;

  insert into public.discussions (
    lokasi_id, bidang_id, tanggal, peserta, hasil, keputusan, catatan
  )
  values (
    p_lokasi_id, p_bidang_id, coalesce(p_tanggal, current_date),
    coalesce(trim(p_peserta), ''), coalesce(trim(p_hasil), ''),
    p_keputusan, nullif(trim(p_catatan), '')
  )
  returning * into v_row;

  perform public.apply_discussion_decision(v_row.lokasi_id, v_row.bidang_id, v_row.keputusan);

  return v_row;
end;
$$;

create or replace function public.update_pembahasan(
  p_id uuid,
  p_tanggal date,
  p_peserta text,
  p_hasil text,
  p_keputusan text,
  p_catatan text
)
returns public.discussions
language plpgsql
as $$
declare
  v_row public.discussions;
begin
  if p_keputusan not in ('LAYAK', 'PERLU_KAJIAN', 'TIDAK_LAYAK') then
    raise exception 'Keputusan tidak dikenal.' using errcode = 'GDE13';
  end if;

  update public.discussions
  set tanggal = coalesce(p_tanggal, tanggal),
      peserta = coalesce(trim(p_peserta), peserta),
      hasil = coalesce(trim(p_hasil), hasil),
      keputusan = p_keputusan,
      catatan = nullif(trim(p_catatan), '')
  where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Pembahasan tidak ditemukan.' using errcode = 'P0002';
  end if;

  perform public.apply_discussion_decision(v_row.lokasi_id, v_row.bidang_id, v_row.keputusan);

  return v_row;
end;
$$;

-- ============================================================
-- RLS: data alur kerja — semua operasi untuk user terautentikasi.
-- ============================================================
alter table public.discussions enable row level security;

drop policy if exists "discussions_select_authenticated" on public.discussions;
create policy "discussions_select_authenticated"
  on public.discussions
  for select
  to authenticated
  using (true);

drop policy if exists "discussions_insert_authenticated" on public.discussions;
create policy "discussions_insert_authenticated"
  on public.discussions
  for insert
  to authenticated
  with check (true);

drop policy if exists "discussions_update_authenticated" on public.discussions;
create policy "discussions_update_authenticated"
  on public.discussions
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "discussions_delete_authenticated" on public.discussions;
create policy "discussions_delete_authenticated"
  on public.discussions
  for delete
  to authenticated
  using (true);
-- GadeSystem — migration: role permissions per menu (pengaturan akses)
-- Matriks role × menu × aksi (view/create/update/delete).
-- Enforcement utama tetap RLS; tabel ini mengatur apa yang terlihat
-- dan dapat dioperasikan per role di aplikasi.

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null
    check (role in ('SUPERADMIN', 'ADMIN', 'SURVEYOR', 'LEGAL')),
  menu_path text not null,
  can_view boolean not null default true,
  can_create boolean not null default false,
  can_update boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role, menu_path)
);

comment on table public.role_permissions is
  'Matriks akses role terhadap menu dan CRUD (menu Pengaturan).';

create index if not exists role_permissions_role_idx on public.role_permissions (role);

create or replace trigger role_permissions_set_updated_at
  before update on public.role_permissions
  for each row
  execute function public.set_updated_at();

-- RLS: semua user terautentikasi membaca (sidebar perlu); ubah hanya SUPERADMIN.
alter table public.role_permissions enable row level security;

drop policy if exists "role_permissions_select_authenticated" on public.role_permissions;
create policy "role_permissions_select_authenticated"
  on public.role_permissions
  for select
  to authenticated
  using (true);

drop policy if exists "role_permissions_write_superadmin" on public.role_permissions;
create policy "role_permissions_write_superadmin"
  on public.role_permissions
  for insert
  to authenticated
  with check (public.is_superadmin());

drop policy if exists "role_permissions_update_superadmin" on public.role_permissions;
create policy "role_permissions_update_superadmin"
  on public.role_permissions
  for update
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

drop policy if exists "role_permissions_delete_superadmin" on public.role_permissions;
create policy "role_permissions_delete_superadmin"
  on public.role_permissions
  for delete
  to authenticated
  using (public.is_superadmin());

-- ============================================================
-- Seed default (on conflict do nothing — tidak menimpa penyesuaian)
-- ============================================================
insert into public.role_permissions (role, menu_path, can_view, can_create, can_update, can_delete)
select
  r.role,
  m.menu_path,
  -- can_view
  case
    when r.role in ('SUPERADMIN', 'ADMIN') then true
    when r.role = 'SURVEYOR' then m.menu_path not in ('/legalitas', '/pembebasan', '/project', '/audit-log')
    when r.role = 'LEGAL' then m.menu_path not in ('/project', '/pembebasan', '/audit-log', '/serah-terima')
  end,
  -- can_create
  case
    when r.role = 'SUPERADMIN' then m.menu_path in ('/lokasi','/bidang','/pihak','/project','/survey','/pembahasan','/legalitas','/pembebasan','/arsip','/serah-terima')
    when r.role = 'ADMIN' then m.menu_path in ('/lokasi','/bidang','/pihak','/project','/survey','/pembahasan','/legalitas','/pembebasan','/arsip','/serah-terima')
    when r.role = 'SURVEYOR' then m.menu_path in ('/lokasi','/bidang','/survey','/pembahasan','/serah-terima')
    when r.role = 'LEGAL' then m.menu_path in ('/legalitas','/survey','/arsip')
  end,
  -- can_update
  case
    when r.role = 'SUPERADMIN' then m.menu_path in ('/lokasi','/bidang','/pihak','/project','/survey','/pembahasan','/legalitas','/pembebasan','/arsip','/serah-terima')
    when r.role = 'ADMIN' then m.menu_path in ('/lokasi','/bidang','/pihak','/project','/survey','/pembahasan','/legalitas','/pembebasan','/arsip','/serah-terima')
    when r.role = 'SURVEYOR' then m.menu_path in ('/lokasi','/bidang','/survey','/pembahasan')
    when r.role = 'LEGAL' then m.menu_path in ('/legalitas','/survey','/arsip')
  end,
  -- can_delete
  case
    when r.role = 'SUPERADMIN' then m.menu_path in ('/lokasi','/bidang','/pihak','/project','/survey','/pembahasan','/legalitas','/pembebasan','/arsip','/serah-terima')
    when r.role = 'ADMIN' then m.menu_path in ('/lokasi','/bidang','/pihak','/project','/survey','/pembahasan','/legalitas','/pembebasan','/arsip','/serah-terima')
    when r.role = 'SURVEYOR' then m.menu_path in ('/survey','/pembahasan')
    when r.role = 'LEGAL' then m.menu_path in ('/legalitas')
  end
from (values ('SUPERADMIN'), ('ADMIN'), ('SURVEYOR'), ('LEGAL')) as r(role)
cross join (
  values ('/dashboard'), ('/lokasi'), ('/bidang'), ('/pihak'), ('/project'),
         ('/survey'), ('/pembahasan'), ('/legalitas'), ('/pembebasan'), ('/arsip'),
         ('/serah-terima'), ('/peta'), ('/laporan'), ('/audit-log'), ('/pengaturan')
) as m(menu_path)
on conflict (role, menu_path) do nothing;

-- ============================================================================
-- Migration: 20260917000023_force_2d_geometry.sql
-- Enforce 2D geometry (st_force2d) preventing Z dimension mismatch
-- ============================================================================

create or replace function public.assert_parcel_geometry(
  p_lokasi_id uuid,
  p_exclude_parcel_id uuid,
  p_new geometry
)
returns void
language plpgsql
as $$
declare
  v_parent geometry;
  v_conflict record;
  v_tolerance_m2 constant double precision := 0.01;
begin
  if p_new is null then
    return;
  end if;

  p_new := st_force2d(p_new);

  if st_geometrytype(p_new) <> 'ST_Polygon' then
    raise exception 'Geometry harus berupa Polygon.' using errcode = 'GDE00';
  end if;

  if not st_isvalid(p_new) then
    raise exception
      'Polygon tidak valid: ada garis yang berpotongan (self-intersection). Perbaiki bentuk polygon lalu simpan lagi.'
      using errcode = 'GDE01';
  end if;

  select geometry into v_parent from public.locations where id = p_lokasi_id;

  if v_parent is null then
    raise exception
      'Batas lokasi induk belum digambar. Gambar batas lokasi terlebih dahulu sebelum memetakan bidang.'
      using errcode = 'GDE04';
  end if;

  if not st_isvalid(v_parent) then
    raise exception 'Batas lokasi induk tidak valid. Hubungi administrator.'
      using errcode = 'GDE05';
  end if;

  if not st_coveredby(p_new, v_parent) then
    raise exception
      'Polygon bidang keluar dari batas lokasi. Pastikan seluruh bidang berada di dalam batas induk.'
      using errcode = 'GDE02';
  end if;

  select p.id, p.kode,
         st_area(st_intersection(p_new, p.geometry)::geography) as overlap_m2
  into v_conflict
  from public.land_parcels lp
  where lp.lokasi_id = p_lokasi_id
    and lp.id is distinct from p_exclude_parcel_id
    and lp.geometry is not null
    and st_intersects(p_new, lp.geometry)
    and st_area(st_intersection(p_new, lp.geometry)::geography) > v_tolerance_m2
  order by 3 desc
  limit 1;

  if found then
    raise exception
      'Polygon bidang overlap dengan bidang % (sekitar % m²). Bidang boleh berbatasan (shared boundary) tetapi tidak boleh bertumpuk.',
      v_conflict.kode, round(v_conflict.overlap_m2::numeric, 1)
      using errcode = 'GDE03';
  end if;
end;
$$;

create or replace function public.validate_parcel_geometry(p_lokasi_id uuid, p_geojson jsonb)
returns void
language plpgsql
as $$
declare
  v_new geometry;
begin
  if p_geojson is null then
    return;
  end if;

  begin
    v_new := st_force2d(st_setsrid(st_geomfromgeojson(p_geojson::text), 4326));
  exception when others then
    raise exception 'Data polygon tidak dapat dibaca. Gambar ulang polygon lalu simpan lagi.'
      using errcode = 'GDE00';
  end if;

  perform public.assert_parcel_geometry(p_lokasi_id, null, v_new);
end;
$$;

create or replace function public.save_parcel_geometry(p_parcel_id uuid, p_geojson jsonb)
returns void
language plpgsql
as $$
declare
  v_new geometry;
  v_lokasi_id uuid;
begin
  if p_geojson is null then
    update public.land_parcels set geometry = null where id = p_parcel_id;
    if not found then
      raise exception 'Bidang tanah tidak ditemukan.' using errcode = 'P0002';
    end if;
    return;
  end if;

  begin
    v_new := st_force2d(st_setsrid(st_geomfromgeojson(p_geojson::text), 4326));
  exception when others then
    raise exception 'Data polygon tidak dapat dibaca. Gambar ulang polygon lalu simpan lagi.'
      using errcode = 'GDE00';
  end if;

  select lokasi_id into v_lokasi_id from public.land_parcels where id = p_parcel_id;
  if v_lokasi_id is null then
    raise exception 'Bidang tanah tidak ditemukan.' using errcode = 'P0002';
  end if;

  perform public.assert_parcel_geometry(v_lokasi_id, p_parcel_id, v_new);

  perform set_config('app.gis_rpc', 'true', true);

  update public.land_parcels set geometry = v_new where id = p_parcel_id;
  if not found then
    raise exception 'Bidang tanah tidak ditemukan.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.force_location_2d_geometry()
returns trigger
language plpgsql
as $$
begin
  if new.geometry is not null then
    new.geometry := st_force2d(new.geometry);
  end if;
  return new;
end;
$$;

drop trigger if exists locations_force_2d on public.locations;
create trigger locations_force_2d
  before insert or update of geometry on public.locations
  for each row
  execute function public.force_location_2d_geometry();
