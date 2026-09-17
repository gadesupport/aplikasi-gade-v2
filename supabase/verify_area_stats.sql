-- GadeSystem — verifikasi perhitungan area & status pemetaan (view
-- location_area_stats). Jalankan SETELAH migration 000000–000007.
-- Semua skenario dalam SATU transaksi, diakhiri ROLLBACK.
-- Harapan: [OK-…]; [FAIL-…] berarti hasil tidak sesuai.

do $$
declare
  v_loc uuid;
  v_a uuid;
  v_b uuid;
  v_c uuid;
  v_status text;
  v_coverage double precision;
  v_parent double precision;
  v_netto double precision;
  v_sisa double precision;
begin
  insert into public.locations (kode, nama, geometry)
  values ('GISTEST-AREA-LOC', 'Uji Area (rollback)', st_geomfromtext(
    'POLYGON((106.80 -6.20, 106.90 -6.20, 106.90 -6.10, 106.80 -6.10, 106.80 -6.20))', 4326))
  returning id into v_loc;

  insert into public.land_parcels (lokasi_id, kode) values (v_loc, 'GISTEST-AR-A') returning id into v_a;
  insert into public.land_parcels (lokasi_id, kode) values (v_loc, 'GISTEST-AR-B') returning id into v_b;
  insert into public.land_parcels (lokasi_id, kode) values (v_loc, 'GISTEST-AR-C') returning id into v_c;

  -- [1] Parent tanpa bidang → BELUM_PENUH, coverage 0.
  select status_pemetaan, coverage_percent into v_status, v_coverage
  from public.location_area_stats where location_id = v_loc;
  if v_status = 'BELUM_PENUH' and v_coverage = 0 then
    raise notice '[OK-1] tanpa bidang: BELUM_PENUH, coverage 0';
  else
    raise notice '[FAIL-1] status=% coverage=% (harapnya BELUM_PENUH / 0)', v_status, v_coverage;
  end if;

  -- [2] Setengah kiri termetakan → BELUM_PENUH, coverage ±50.
  perform public.save_parcel_geometry(v_a, '{
    "type":"Polygon","coordinates":[[
      [106.80,-6.20],[106.85,-6.20],[106.85,-6.10],[106.80,-6.10],[106.80,-6.20]
    ]]}'::jsonb);
  select status_pemetaan, coverage_percent into v_status, v_coverage
  from public.location_area_stats where location_id = v_loc;
  if v_status = 'BELUM_PENUH' and v_coverage between 49 and 51 then
    raise notice '[OK-2] setengah termetakan: BELUM_PENUH, coverage %', v_coverage;
  else
    raise notice '[FAIL-2] status=% coverage=% (harapnya BELUM_PENUH / ±50)', v_status, v_coverage;
  end if;

  -- [3] Ditambah setengah kanan (shared boundary) → TERPETAK_PENUH, ±100.
  perform public.save_parcel_geometry(v_b, '{
    "type":"Polygon","coordinates":[[
      [106.85,-6.20],[106.90,-6.20],[106.90,-6.10],[106.85,-6.10],[106.85,-6.20]
    ]]}'::jsonb);
  select status_pemetaan, coverage_percent, luas_parent_m2, luas_bidang_netto_m2, sisa_luas_m2
  into v_status, v_coverage, v_parent, v_netto, v_sisa
  from public.location_area_stats where location_id = v_loc;
  if v_status = 'TERPETAK_PENUH' and v_coverage between 99.5 and 100 then
    raise notice '[OK-3] penuh: TERPETAK_PENUH, coverage %, sisa ~% m²', v_coverage, round(v_sisa::numeric, 2);
  else
    raise notice '[FAIL-3] status=% coverage=% (harapnya TERPETAK_PENUH / ±100)', v_status, v_coverage;
  end if;
  if v_parent is not null and v_netto is not null and abs(v_parent - v_netto) < 1 then
    raise notice '[OK-3b] luas parent ≈ netto (parent %, netto %)', round(v_parent::numeric, 1), round(v_netto::numeric, 1);
  else
    raise notice '[FAIL-3b] parent=% netto=% selisih terlalu besar', v_parent, v_netto;
  end if;

  -- [4] Sisipkan bidang C overlap langsung via SQL (menembus RPC untuk
  --     mensimulasikan data bermasalah) → status OVERLAP.
  update public.land_parcels
  set geometry = st_geomfromtext(
    'POLYGON((106.82 -6.20, 106.87 -6.20, 106.87 -6.10, 106.82 -6.10, 106.82 -6.20))', 4326)
  where id = v_c;
  select status_pemetaan into v_status
  from public.location_area_stats where location_id = v_loc;
  if v_status = 'OVERLAP' then
    raise notice '[OK-4] overlap terdeteksi: OVERLAP';
  else
    raise notice '[FAIL-4] status=% (harapnya OVERLAP)', v_status;
  end if;

  raise notice 'Selesai — semua data uji di-ROLLBACK.';
end $$;

rollback;
