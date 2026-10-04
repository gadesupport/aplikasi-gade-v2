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
