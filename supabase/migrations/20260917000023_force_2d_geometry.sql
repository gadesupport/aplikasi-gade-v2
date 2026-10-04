-- GadeSystem — migration: enforce 2D geometry (st_force2d)
-- Mencegah error "Geometry has Z dimension but column does not" saat data
-- KML, Shapefile 3D, atau CAD yang membawa elevasi/Z diimpor ke kolom
-- geometry(Polygon, 4326).

-- 1. Perbarui assert_parcel_geometry (nama parameter p_new dipertahankan agar tidak bentrok 42P13)
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

-- 2. Perbarui validate_parcel_geometry RPC
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

-- 3. Perbarui save_parcel_geometry RPC
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

-- 4. Trigger auto-force 2D pada tabel locations
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
