-- GadeSystem — verifikasi GIS setelah migration dijalankan.
-- Jalankan seluruh file ini di Supabase Dashboard → SQL Editor (sebagai postgres).
-- Semua query hanya membaca; uji tulis diakhiri ROLLBACK sehingga tidak
-- meninggalkan data. Bandingkan hasil dengan "Harapan" di tiap bagian.

-- ============================================================
-- 1. PostGIS terpasang — Harapan: 1 baris, extname = postgis
-- ============================================================
select e.extname, n.nspname as installed_in_schema
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
where e.extname = 'postgis';

-- ============================================================
-- 2. Fungsi PostGIS bekerja — Harapan: true, false
--    (polygon kedua sengaja self-intersecting)
-- ============================================================
select
  st_isvalid(st_geomfromtext(
    'POLYGON((106.8 -6.2, 106.9 -6.2, 106.9 -6.1, 106.8 -6.1, 106.8 -6.2))', 4326
  )) as polygon_valid,
  st_isvalid(st_geomfromtext(
    'POLYGON((0 0, 1 1, 1 0, 0 1, 0 0))', 4326
  )) as polygon_bowtie_harusnya_false;

-- ============================================================
-- 3. Kolom geometry — Harapan: 2 baris, type = POLYGON, srid = 4326
-- ============================================================
select f_table_name, f_geometry_column, type, srid
from geometry_columns
where f_table_schema = 'public'
  and f_table_name in ('locations', 'land_parcels')
order by f_table_name;

-- ============================================================
-- 4. Spatial index GIST — Harapan: locations_geometry_idx,
--    land_parcels_geometry_idx (masing-masing dengan " USING gist ")
-- ============================================================
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('locations', 'land_parcels')
  and indexdef ilike '%gist%'
order by tablename;

-- ============================================================
-- 5. Guard validitas — Harapan: 2 baris dengan nama constraint yang sama
-- ============================================================
select conrelid::regclass as tabel, conname
from pg_constraint
where conname in ('locations_geometry_valid', 'land_parcels_geometry_valid')
order by 1;

-- ============================================================
-- 6. Uji end-to-end tulis + baca geometry (diakhiri ROLLBACK)
--    Harapan: lokasi_uji = 1, bidang_uji = 1 — lalu TIDAK tersimpan.
-- ============================================================
begin;

insert into public.locations (kode, nama, geometry)
values (
  'GIS-TEST-0001',
  'Uji GIS (rollback)',
  st_geomfromtext(
    'POLYGON((106.80 -6.20, 106.90 -6.20, 106.90 -6.10, 106.80 -6.10, 106.80 -6.20))',
    4326
  )
);

insert into public.land_parcels (lokasi_id, kode, geometry)
select
  id,
  'GIS-TEST-PARCEL',
  st_geomfromtext(
    'POLYGON((106.82 -6.19, 106.88 -6.19, 106.88 -6.15, 106.82 -6.15, 106.82 -6.19))',
    4326
  )
from public.locations
where kode = 'GIS-TEST-0001';

select
  (select count(*) from public.locations where kode = 'GIS-TEST-0001') as lokasi_uji,
  (select count(*) from public.land_parcels where kode = 'GIS-TEST-PARCEL') as bidang_uji,
  st_area(
    (select geometry from public.locations where kode = 'GIS-TEST-0001')::geography
  ) as luas_lokasi_m2
;

rollback;
