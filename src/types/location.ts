export type LocationStatus =
  | 'SURVEY'
  | 'PEMBAHASAN'
  | 'PROSES_PEMBEBASAN'
  | 'SELESAI'
  | 'DITOLAK'
  | 'DITUNDA'

export const LOCATION_STATUSES: LocationStatus[] = [
  'SURVEY',
  'PEMBAHASAN',
  'PROSES_PEMBEBASAN',
  'SELESAI',
  'DITOLAK',
  'DITUNDA',
]

export const LOCATION_STATUS_LABELS: Record<LocationStatus, string> = {
  SURVEY: 'Survey',
  PEMBAHASAN: 'Pembahasan',
  PROSES_PEMBEBASAN: 'Proses Pembebasan',
  SELESAI: 'Selesai',
  DITOLAK: 'Ditolak',
  DITUNDA: 'Ditunda',
}

// Baris tabel public.locations. Kolom geometry (Polygon PostGIS) sengaja
// belum diekspos — akan ditangani mapService/polygon editor (AGENTS.md §17).
export interface LocationRecord {
  id: string
  kode: string
  nama: string
  alamat: string | null
  desa: string | null
  kecamatan: string | null
  kabupaten: string | null
  luas_target: number | null
  luas_teridentifikasi: number | null
  luas_deal: number | null
  peruntukan: string | null
  kondisi_lahan: string | null
  kondisi_pasar: string | null
  catatan: string | null
  status: LocationStatus
  created_at: string
  updated_at: string
}

export interface LocationInput {
  kode: string
  nama: string
  alamat: string | null
  desa: string | null
  kecamatan: string | null
  kabupaten: string | null
  luas_target: number | null
  luas_teridentifikasi: number | null
  luas_deal: number | null
  peruntukan: string | null
  kondisi_lahan: string | null
  kondisi_pasar: string | null
  catatan: string | null
  status: LocationStatus
}
