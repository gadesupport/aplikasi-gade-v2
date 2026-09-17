-- GadeSystem — verifikasi validasi spatial polygon bidang.
-- Jalankan SETELAH migration 000000–000006 di SQL Editor (postgres).
-- Semua skenario berjalan dalam SATU transaksi dan diakhiri ROLLBACK —
-- tidak meninggalkan data. Harapan ditandai [OK-…]; jika muncul [FAIL-…]
-- berarti validasi tidak bekerja sesuai harapan.

do $$
declare
  v_loc uuid;
  v_loc_tanpa_batas uuid;
  v_a uuid;
  v_b uuid;
  v_c uuid;
  v_d uuid;
  v_state text;
  v_count int;
begin
  -- Setup: lokasi berbatas + bidang A/B/C; lokasi tanpa batas + bidang D.
  insert into public.locations (kode, nama, geometry)
  values ('GISTEST-LOC', 'Uji Validasi (rollback)', st_geomfromtext(
    'POLYGON((106.80 -6.20, 106.90 -6.20, 106.90 -6.10, 106.80 -6.10, 106.80 -6.20))', 4326))
  returning id into v_loc;

  insert into public.locations (kode, nama) values ('GISTEST-LOC2', 'Tanpa Batas (rollback)')
  returning id into v_loc_tanpa_batas;

  insert into public.land_parcels (lokasi_id, kode) values (v_loc, 'GISTEST-A') returning id into v_a;
  insert into public.land_parcels (lokasi_id, kode) values (v_loc, 'GISTEST-B') returning id into v_b;
  insert into public.land_parcels (lokasi_id, kode) values (v_loc, 'GISTEST-C') returning id into v_c;
  insert into public.land_parcels (lokasi_id, kode) values (v_loc_tanpa_batas, 'GISTEST-D') returning id into v_d;

  -- [1] Bidang di dalam parent → diterima.
  begin
    perform public.save_parcel_geometry(v_a, '{
      "type":"Polygon","coordinates":[[
        [106.80,-6.20],[106.85,-6.20],[106.85,-6.10],[106.80,-6.10],[106.80,-6.20]
      ]]}'::jsonb);
    raise notice '[OK-1] bidang dalam parent diterima';
  exception when others then
    raise notice '[FAIL-1] seharusnya diterima, malah error: %', sqlerrm;
  end;

  -- [2] Shared boundary dengan A (menempel, tanpa bertumpuk) → diterima.
  begin
    perform public.save_parcel_geometry(v_b, '{
      "type":"Polygon","coordinates":[[
        [106.85,-6.20],[106.90,-6.20],[106.90,-6.10],[106.85,-6.10],[106.85,-6.20]
      ]]}'::jsonb);
    raise notice '[OK-2] shared boundary diterima';
  exception when others then
    raise notice '[FAIL-2] shared boundary seharusnya diterima, error: %', sqlerrm;
  end;

  -- [3] Overlap dengan A (bertumpuk 0.01 x 0.10 derajat) → ditolak GDE03.
  begin
    perform public.save_parcel_geometry(v_c, '{
      "type":"Polygon","coordinates":[[
        [106.84,-6.20],[106.90,-6.20],[106.90,-6.10],[106.84,-6.10],[106.84,-6.20]
      ]]}'::jsonb);
    raise notice '[FAIL-3] overlap seharusnya DITOLAK';
  exception when others then
    get stacked diagnostics v_state = RETURNED_SQLSTATE;
    raise notice '[OK-3] overlap ditolak (code=%, pesan=%)', v_state, sqlerrm;
  end;

  select count(*) into v_count from public.land_parcels where id = v_c and geometry is null;
  if v_count = 1 then
    raise notice '[OK-3b] polygon overlap TIDAK tersimpan (geometry tetap null)';
  else
    raise notice '[FAIL-3b] polygon overlap ternyata tersimpan!';
  end if;

  -- [4] Di luar batas induk → ditolak GDE02.
  begin
    perform public.save_parcel_geometry(v_c, '{
      "type":"Polygon","coordinates":[[
        [106.95,-6.25],[106.99,-6.25],[106.99,-6.21],[106.95,-6.21],[106.95,-6.25]
      ]]}'::jsonb);
    raise notice '[FAIL-4] di luar parent seharusnya DITOLAK';
  exception when others then
    get stacked diagnostics v_state = RETURNED_SQLSTATE;
    raise notice '[OK-4] di luar parent ditolak (code=%, pesan=%)', v_state, sqlerrm;
  end;

  -- [5] Self-intersecting (bowtie) di dalam parent → ditolak GDE01.
  begin
    perform public.save_parcel_geometry(v_c, '{
      "type":"Polygon","coordinates":[[
        [106.81,-6.19],[106.84,-6.11],[106.84,-6.19],[106.81,-6.11],[106.81,-6.19]
      ]]}'::jsonb);
    raise notice '[FAIL-5] self-intersection seharusnya DITOLAK';
  exception when others then
    get stacked diagnostics v_state = RETURNED_SQLSTATE;
    raise notice '[OK-5] self-intersection ditolak (code=%, pesan=%)', v_state, sqlerrm;
  end;

  -- [6] Lokasi induk belum digambar → ditolak GDE04.
  begin
    perform public.save_parcel_geometry(v_d, '{
      "type":"Polygon","coordinates":[[
        [106.80,-6.20],[106.85,-6.20],[106.85,-6.10],[106.80,-6.10],[106.80,-6.20]
      ]]}'::jsonb);
    raise notice '[FAIL-6] tanpa batas induk seharusnya DITOLAK';
  exception when others then
    get stacked diagnostics v_state = RETURNED_SQLSTATE;
    raise notice '[OK-6] tanpa batas induk ditolak (code=%, pesan=%)', v_state, sqlerrm;
  end;

  -- [7] Hapus pemetaan (null) → diterima.
  begin
    perform public.save_parcel_geometry(v_a, null);
    raise notice '[OK-7] hapus polygon diterima';
  exception when others then
    raise notice '[FAIL-7] hapus polygon error: %', sqlerrm;
  end;

  raise notice 'Selesai — semua data uji di-ROLLBACK.';
end $$;

rollback;
