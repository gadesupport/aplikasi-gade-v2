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
        using errcode = 'PGRST116';
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
      using errcode = 'PGRST116';
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
      using errcode = 'PGRST116';
  end if;
end;
$$;

comment on function public.save_parcel_geometry(uuid, jsonb) is
  'Validasi spatial + simpan polygon bidang; menolak polygon invalid, di luar induk, atau overlap.';
