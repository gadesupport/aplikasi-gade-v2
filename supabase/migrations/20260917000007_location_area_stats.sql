-- GadeSystem — migration: perhitungan area & status pemetaan per lokasi
-- View location_area_stats (AGENTS.md §17.6), dihitung PostGIS saat dibaca:
--   luas_parent_m2         luas batas induk (ST_Area geography, m²)
--   luas_bidang_bruto_m2   Σ luas tiap polygon bidang (overlap dihitung ganda)
--   luas_bidang_netto_m2   luas ST_Union seluruh bidang (overlap dihitung sekali)
--   sisa_luas_m2           parent − netto (min 0)
--   coverage_percent       netto ÷ parent × 100 (dikunci maks 100)
--   status_pemetaan        GEOMETRY_INVALID > OVERLAP > TERPETAK_PENUH > BELUM_PENUH
--
-- Aturan status:
--   GEOMETRY_INVALID  parent/ada bidang invalid (defensif; CHECK sudah mencegah)
--   OVERLAP           bruto > netto + 0,01 m² (ada bidang bertumpuk)
--   TERPETAK_PENUH    sisa ≤ 1 m²
--   BELUM_PENUH       lainnya (termasuk batas induk belum digambar)
--
-- security_invoker → view mengeksekusi sebagai pemanggil sehingga RLS
-- locations/land_parcels tetap berlaku.

create or replace view public.location_area_stats
with (security_invoker = true) as
select
  l.id as location_id,
  c.luas_parent_m2,
  c.luas_bidang_bruto_m2,
  c.luas_bidang_netto_m2,
  c.sisa_luas_m2,
  c.coverage_percent,
  c.bidang_terpetakan,
  c.bidang_total,
  c.status_pemetaan
from public.locations l
cross join lateral (
  select
    base.*,
    case
      when base.luas_parent_m2 is null then null
      else least(round((base.luas_bidang_netto_m2 / base.luas_parent_m2) * 100, 2), 100)
    end as coverage_percent,
    case
      when base.invalid_geometry then 'GEOMETRY_INVALID'
      when base.luas_parent_m2 is null then 'BELUM_PENUH'
      when base.luas_bidang_bruto_m2 > base.luas_bidang_netto_m2 + 0.01 then 'OVERLAP'
      when base.luas_bidang_netto_m2 >= base.luas_parent_m2 - 1 then 'TERPETAK_PENUH'
      else 'BELUM_PENUH'
    end as status_pemetaan
  from (
    select
      st_area(l.geometry::geography) as luas_parent_m2,
      agg.bidang_terpetakan,
      agg.bidang_total,
      coalesce(agg.luas_bidang_bruto_m2, 0) as luas_bidang_bruto_m2,
      coalesce(agg.luas_bidang_netto_m2, 0) as luas_bidang_netto_m2,
      case
        when l.geometry is null then null
        else greatest(st_area(l.geometry::geography) - coalesce(agg.luas_bidang_netto_m2, 0), 0)
      end as sisa_luas_m2,
      (
        (l.geometry is not null and not st_isvalid(l.geometry))
        or coalesce(agg.any_invalid_geometry, false)
      ) as invalid_geometry
    from (
      select
        count(p.geometry) as bidang_terpetakan,
        count(*) as bidang_total,
        sum(st_area(p.geometry::geography)) as luas_bidang_bruto_m2,
        st_area(st_union(p.geometry)::geography) as luas_bidang_netto_m2,
        bool_or(not st_isvalid(p.geometry)) as any_invalid_geometry
      from public.land_parcels p
      where p.lokasi_id = l.id
    ) agg
  ) base
) c;

grant select on public.location_area_stats to authenticated;

comment on view public.location_area_stats is
  'Statistik pemetaan per lokasi: luas parent/bidang, sisa, coverage, status (AGENTS.md §17.6).';
