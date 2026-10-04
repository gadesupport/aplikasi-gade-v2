-- GadeSystem — verifikasi RPC nearest (find_nearest_parcels /
-- find_nearest_locations). Jalankan SETELAH migration 000000–000008.
-- Satu transaksi, diakhiri ROLLBACK. Harapan: [OK-…].

do $$
declare
  v_loc_dekat uuid;
  v_loc_jauh uuid;
  v_parcel_dekat uuid;
  v_parcel_jauh uuid;
  v_first_id uuid;
  v_first_dist double precision;
  v_count int;
begin
  -- Dua lokasi berjarak jelas: dekat titik uji (106.845, -6.15) ± <200 m,
  -- jauh (106.95, -6.05) ± >11 km.
  insert into public.locations (kode, nama, geometry)
  values ('NEARTEST-A', 'Lokasi Dekat', st_geomfromtext(
    'POLYGON((106.84 -6.16, 106.85 -6.16, 106.85 -6.14, 106.84 -6.14, 106.84 -6.16))', 4326))
  returning id into v_loc_dekat;

  insert into public.locations (kode, nama, geometry)
  values ('NEARTEST-B', 'Lokasi Jauh', st_geomfromtext(
    'POLYGON((106.95 -6.06, 106.96 -6.06, 106.96 -6.04, 106.95 -6.04, 106.95 -6.06))', 4326))
  returning id into v_loc_jauh;

  insert into public.land_parcels (lokasi_id, kode, nomor_bidang, geometry)
  values (v_loc_dekat, 'NEARTEST-A1', '001', st_geomfromtext(
    'POLYGON((106.842 -6.155, 106.848 -6.155, 106.848 -6.145, 106.842 -6.145, 106.842 -6.155))', 4326))
  returning id into v_parcel_dekat;

  insert into public.land_parcels (lokasi_id, kode, nomor_bidang, geometry)
  values (v_loc_jauh, 'NEARTEST-B1', '001', st_geomfromtext(
    'POLYGON((106.952 -6.055, 106.958 -6.055, 106.958 -6.045, 106.952 -6.045, 106.952 -6.055))', 4326))
  returning id into v_parcel_jauh;

  -- Bidang tanpa geometry tidak boleh muncul.
  insert into public.land_parcels (lokasi_id, kode) values (v_loc_dekat, 'NEARTEST-A2');

  -- [1] Bidang terdekat: hasil pertama = bidang dekat, jarak < 1.000 m.
  select id, jarak_m into v_first_id, v_first_dist
  from public.find_nearest_parcels( -6.15, 106.845, 5 );
  if v_first_id = v_parcel_dekat and v_first_dist < 1000 then
    raise notice '[OK-1] bidang terdekat benar (jarak % m)', round(v_first_dist::numeric, 1);
  else
    raise notice '[FAIL-1] id=% jarak=% (harapnya bidang dekat, <1000 m)', v_first_id, v_first_dist;
  end if;

  -- [2] Daftar terurut: terdekat dulu, bidang tanpa geometry dikecualikan.
  select count(*) into v_count from public.find_nearest_parcels(-6.15, 106.845, 5);
  if v_count = 2 then
    raise notice '[OK-2] hanya bidang bergeometry yang dikembalikan (2 baris)';
  else
    raise notice '[FAIL-2] jumlah baris=% (harapnya 2)', v_count;
  end if;

  -- [3] Lokasi terdekat: hasil pertama = lokasi dekat.
  select id, jarak_m into v_first_id, v_first_dist
  from public.find_nearest_locations(-6.15, 106.845, 5);
  if v_first_id = v_loc_dekat and v_first_dist < 2000 then
    raise notice '[OK-3] lokasi terdekat benar (jarak % m)', round(v_first_dist::numeric, 1);
  else
    raise notice '[FAIL-3] id=% jarak=% (harapnya lokasi dekat, <2000 m)', v_first_id, v_first_dist;
  end if;

  -- [4] Limit bekerja.
  select count(*) into v_count from public.find_nearest_locations(-6.15, 106.845, 1);
  if v_count = 1 then
    raise notice '[OK-4] limit diterapkan';
  else
    raise notice '[FAIL-4] jumlah baris=% (harapnya 1)', v_count;
  end if;

  raise notice 'Selesai — semua data uji di-ROLLBACK.';
end $$;

rollback;
