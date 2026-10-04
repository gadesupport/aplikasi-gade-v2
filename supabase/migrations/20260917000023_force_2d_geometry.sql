-- GadeSystem — migration: enforce 2D geometry (st_force2d)
-- Mencegah error "Geometry has Z dimension but column does not" saat data
-- KML, Shapefile 3D, atau CAD yang membawa elevasi/Z diimpor ke kolom
-- geometry(Polygon, 4326).

-- 1. Perbarui assert_parcel_geometry agar memaksakan 2D
create or replace function public.assert_parcel_geometry(
  p_lokasi_id uuid,
  p_exclude_parcel_id uuid,
  p_geometry geometry
)
returns void
language plpgsql
as $$
declare
  v_parent geometry;
  v_overlap_count integer;
  v_2d geometry;
begin
  if p_geometry is null then
    return;
  end if;

  v_2d := st_force2d(p_geometry);

  if st_geometrytype(v_2d) <> 'ST_Polygon' then
    raise exception 'Geometry harus berupa Polygon.'
      using errcode = 'GDE00';
  end if;

  if not st_isvalid(v_2d) then
    raise exception
      'Polygon tidak valid: ada garis yang berpotongan (self-intersection). Perbaiki bentuk polygon lalu simpan lagi.'
      using errcode = 'GDE01';
  end if;

  if st_area(v_2d::geography) <= 0 then
    raise exception 'Luas polygon harus lebih besar dari 0.'
      using errcode = 'GDE05';
  end if;

  select geometry into v_parent from public.locations where id = p_lokasi_id;
  if v_parent is null then
    raise exception
      'Batas lokasi induk belum digambar. Gambar batas lokasi terlebih dahulu sebelum memetakan bidang.'
      using errcode = 'GDE04';
  end if;

  if not (st_covers(v_parent, v_2d) or st_within(v_2d, v_parent)) then
    raise exception
      'Polygon bidang harus berada sepenuhnya di dalam batas lokasi.'
      using errcode = 'GDE02';
  end if;

  select count(*) into v_overlap_count
  from public.land_parcels lp
  where lp.lokasi_id = p_lokasi_id
    and lp.geometry is not null
    and (p_exclude_parcel_id is null or lp.id <> p_exclude_parcel_id)
    and st_overlaps(lp.geometry, v_2d);

  if v_overlap_count > 0 then
    raise exception
      'Polygon bertumpukan (overlap) dengan bidang lain yang sudah ada pada lokasi ini. Sesuaikan batas bidang.'
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
