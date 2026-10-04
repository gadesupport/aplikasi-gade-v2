-- GadeSystem — migration: statistik dashboard (AGENTS.md §30)
-- Satu RPC mengembalikan seluruh angka dashboard sebagai jsonb (satu call).
-- Invoker → RLS semua tabel tetap berlaku. Read-only (stable).

create or replace function public.dashboard_stats()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'lokasi', jsonb_build_object(
      'total', (select count(*) from public.locations),
      'survey', (select count(*) from public.locations where status = 'SURVEY'),
      'pembahasan', (select count(*) from public.locations where status = 'PEMBAHASAN'),
      'proses_pembebasan', (select count(*) from public.locations where status = 'PROSES_PEMBEBASAN'),
      'selesai', (select count(*) from public.locations where status = 'SELESAI'),
      'ditolak', (select count(*) from public.locations where status = 'DITOLAK'),
      'ditunda', (select count(*) from public.locations where status = 'DITUNDA')
    ),
    'bidang', jsonb_build_object(
      'total', (select count(*) from public.land_parcels),
      'teridentifikasi', (select count(*) from public.land_parcels where status_pembebasan = 'TERIDENTIFIKASI'),
      'survey', (select count(*) from public.land_parcels where status_pembebasan = 'SURVEY'),
      'legal_check', (select count(*) from public.land_parcels where status_pembebasan = 'LEGAL_CHECK'),
      'negosiasi', (select count(*) from public.land_parcels where status_pembebasan = 'NEGOSIASI'),
      'siap_transaksi', (select count(*) from public.land_parcels where status_pembebasan = 'SIAP_TRANSAKSI'),
      'transaksi', (select count(*) from public.land_parcels where status_pembebasan = 'TRANSAKSI'),
      'selesai', (select count(*) from public.land_parcels where status_pembebasan = 'SELESAI'),
      'ditolak', (select count(*) from public.land_parcels where status_pembebasan = 'DITOLAK'),
      'ditunda', (select count(*) from public.land_parcels where status_pembebasan = 'DITUNDA')
    ),
    'pihak', jsonb_build_object(
      'total', (select count(*) from public.parties)
    ),
    'legalitas', jsonb_build_object(
      'total', (select count(*) from public.legalities),
      'ada', (select count(*) from public.legalities where status = 'ADA'),
      'belum_ada', (select count(*) from public.legalities where status = 'BELUM_ADA'),
      'proses', (select count(*) from public.legalities where status = 'PROSES'),
      'tidak_relevan', (select count(*) from public.legalities where status = 'TIDAK_RELEVAN'),
      'perlu_verifikasi', (select count(*) from public.legalities where status = 'PERLU_VERIFIKASI')
    ),
    'luas', jsonb_build_object(
      'target', (select coalesce(sum(luas_target), 0) from public.locations),
      'teridentifikasi', (select coalesce(sum(luas_teridentifikasi), 0) from public.locations),
      'deal', (select coalesce(sum(luas_deal), 0) from public.locations)
    ),
    'arsip', jsonb_build_object(
      'total', (select count(*) from public.archives),
      'tersedia', (select count(*) from public.archives where status = 'TERSEDIA'),
      'dipinjam', (select count(*) from public.archives where status = 'DIPINJAM'),
      'hilang', (select count(*) from public.archives where status = 'HILANG'),
      'rusak', (select count(*) from public.archives where status = 'RUSAK'),
      'diarsipkan', (select count(*) from public.archives where status = 'DIARSIPKAN'),
      'dokumen_digital', (select count(*) from public.archive_documents)
    ),
    'gis', jsonb_build_object(
      'lokasi_geometry', (select count(*) from public.locations where geometry is not null),
      'bidang_geometry', (select count(*) from public.land_parcels where geometry is not null),
      'geometry_invalid',
        (select count(*) from public.locations where geometry is not null and not st_isvalid(geometry))
        + (select count(*) from public.land_parcels where geometry is not null and not st_isvalid(geometry)),
      'overlap', (select count(*) from public.location_area_stats where status_pemetaan = 'OVERLAP'),
      'luas_parent_m2', (select coalesce(sum(luas_parent_m2), 0) from public.location_area_stats),
      'luas_terpetakan_m2', (select coalesce(sum(luas_bidang_netto_m2), 0) from public.location_area_stats),
      'coverage_percent', (
        select case
          when coalesce(sum(luas_parent_m2), 0) = 0 then null
          else least(round(((sum(luas_bidang_netto_m2) / sum(luas_parent_m2)) * 100)::numeric, 1), 100)
        end
        from public.location_area_stats where luas_parent_m2 is not null
      )
    )
  )
$$;

comment on function public.dashboard_stats() is
  'Statistik dashboard lengkap dalam satu jsonb (AGENTS.md §30).';
