export type AreaStatus = 'TERPETAK_PENUH' | 'BELUM_PENUH' | 'OVERLAP' | 'GEOMETRY_INVALID'

export const AREA_STATUSES: AreaStatus[] = [
  'TERPETAK_PENUH',
  'BELUM_PENUH',
  'OVERLAP',
  'GEOMETRY_INVALID',
]

export const AREA_STATUS_LABELS: Record<AreaStatus, string> = {
  TERPETAK_PENUH: 'Terpetak Penuh',
  BELUM_PENUH: 'Belum Penuh',
  OVERLAP: 'Overlap',
  GEOMETRY_INVALID: 'Geometry Invalid',
}

// Baris view public.location_area_stats — dihitung PostGIS saat dibaca
// (migration 20260917000007).
export interface LocationAreaStats {
  location_id: string
  luas_parent_m2: number | null
  // Σ luas tiap polygon (overlap terhitung ganda).
  luas_bidang_bruto_m2: number
  // Luas ST_Union seluruh bidang (overlap terhitung sekali).
  luas_bidang_netto_m2: number
  sisa_luas_m2: number | null
  coverage_percent: number | null
  bidang_terpetakan: number
  bidang_total: number
  status_pemetaan: AreaStatus
}
