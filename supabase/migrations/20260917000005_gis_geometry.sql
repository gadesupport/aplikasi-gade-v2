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
