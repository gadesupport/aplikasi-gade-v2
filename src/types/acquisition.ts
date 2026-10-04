export type AcquisitionStatus =
  | 'NEGOSIASI'
  | 'SIAP_TRANSAKSI'
  | 'TRANSAKSI'
  | 'SELESAI'
  | 'BATAL'

export const ACQUISITION_STATUSES: AcquisitionStatus[] = [
  'NEGOSIASI',
  'SIAP_TRANSAKSI',
  'TRANSAKSI',
  'SELESAI',
  'BATAL',
]

export const ACQUISITION_STATUS_LABELS: Record<AcquisitionStatus, string> = {
  NEGOSIASI: 'Negosiasi',
  SIAP_TRANSAKSI: 'Siap Transaksi',
  TRANSAKSI: 'Transaksi',
  SELESAI: 'Selesai',
  BATAL: 'Batal',
}

// Referensi bidang pada pembebasan (hasil embed PostgREST).
export interface AcquisitionParcelRef {
  id: string
  kode: string
  nomor_bidang: string | null
  lokasi: { id: string; kode: string; nama: string } | null
}

// Baris tabel public.acquisitions (AGENTS.md §10).
export interface AcquisitionRecord {
  id: string
  bidang_id: string
  tanggal_mulai: string
  harga_penawaran: number | null
  harga_kesepakatan: number | null
  luas_dibebaskan: number | null
  uang_muka: number | null
  pelunasan: number | null
  tanggal_pelunasan: string | null
  pihak_terlibat: string | null
  catatan: string | null
  status_transaksi: AcquisitionStatus
  created_at: string
  updated_at: string
}

export interface AcquisitionWithParcel extends AcquisitionRecord {
  land_parcels: AcquisitionParcelRef | null
}

export interface AcquisitionInput {
  bidang_id: string
  tanggal_mulai: string
  harga_penawaran: number | null
  harga_kesepakatan: number | null
  luas_dibebaskan: number | null
  uang_muka: number | null
  pelunasan: number | null
  tanggal_pelunasan: string | null
  pihak_terlibat: string | null
  catatan: string | null
  status_transaksi: AcquisitionStatus
}

// Baris view acquisition_location_recap — rekap per lokasi (non-BATAL
// untuk totalan; seluruh status untuk hitungan).
export interface AcquisitionRecap {
  location_id: string
  jumlah_aktif: number
  bidang_dibebaskan: number
  negosiasi: number
  siap_transaksi: number
  transaksi: number
  selesai: number
  batal: number
  luas_dibebaskan_m2: number
  total_harga_kesepakatan: number
  total_uang_muka: number
  total_pelunasan: number
}
