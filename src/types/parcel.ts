export type ParcelStatus =
  | 'TERIDENTIFIKASI'
  | 'SURVEY'
  | 'LEGAL_CHECK'
  | 'NEGOSIASI'
  | 'SIAP_TRANSAKSI'
  | 'TRANSAKSI'
  | 'SELESAI'
  | 'DITOLAK'
  | 'DITUNDA'

export const PARCEL_STATUSES: ParcelStatus[] = [
  'TERIDENTIFIKASI',
  'SURVEY',
  'LEGAL_CHECK',
  'NEGOSIASI',
  'SIAP_TRANSAKSI',
  'TRANSAKSI',
  'SELESAI',
  'DITOLAK',
  'DITUNDA',
]

export const PARCEL_STATUS_LABELS: Record<ParcelStatus, string> = {
  TERIDENTIFIKASI: 'Teridentifikasi',
  SURVEY: 'Survey',
  LEGAL_CHECK: 'Legal Check',
  NEGOSIASI: 'Negosiasi',
  SIAP_TRANSAKSI: 'Siap Transaksi',
  TRANSAKSI: 'Transaksi',
  SELESAI: 'Selesai',
  DITOLAK: 'Ditolak',
  DITUNDA: 'Ditunda',
}

// Saran jenis hak untuk input form (datalist) — bukan konstrain database.
export const JENIS_HAK_SUGGESTIONS = [
  'SHM',
  'SHGB',
  'HGU',
  'HPL',
  'Girik',
  'Letter C',
  'Belum Bersertifikat',
]

// Referensi lokasi induk (hasil embed PostgREST).
export interface ParcelLocationRef {
  id: string
  kode: string
  nama: string
}

// Baris tabel public.land_parcels. Kolom geometry (Polygon PostGIS) sengaja
// belum diekspos — akan ditangani mapService/polygon editor (AGENTS.md §17).
export interface ParcelRecord {
  id: string
  lokasi_id: string
  kode: string
  nomor_bidang: string | null
  luas: number | null
  jenis_hak: string | null
  nomor_hak: string | null
  status_pembebasan: ParcelStatus
  harga_penawaran: number | null
  harga_kesepakatan: number | null
  tanggal_kesepakatan: string | null
  catatan: string | null
  created_at: string
  updated_at: string
}

export interface ParcelWithLocation extends ParcelRecord {
  lokasi: ParcelLocationRef | null
}

export interface ParcelInput {
  lokasi_id: string
  kode: string
  nomor_bidang: string | null
  luas: number | null
  jenis_hak: string | null
  nomor_hak: string | null
  status_pembebasan: ParcelStatus
  harga_penawaran: number | null
  harga_kesepakatan: number | null
  tanggal_kesepakatan: string | null
  catatan: string | null
}
