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
