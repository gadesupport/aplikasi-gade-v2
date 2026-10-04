// Field target GADE untuk import GIS (§24) — dipakai service, lib, dan UI.

export type GadeField =
  | 'kode'
  | 'nomor_bidang'
  | 'luas'
  | 'jenis_hak'
  | 'nomor_hak'
  | 'status'
  | 'nama_pihak'

export const GADE_FIELDS: { key: GadeField; label: string }[] = [
  { key: 'kode', label: 'Kode Bidang' },
  { key: 'nomor_bidang', label: 'Nomor Bidang' },
  { key: 'luas', label: 'Luas (m²)' },
  { key: 'jenis_hak', label: 'Jenis Hak' },
  { key: 'nomor_hak', label: 'Nomor Hak' },
  { key: 'status', label: 'Status Pembebasan' },
  { key: 'nama_pihak', label: 'Nama Pihak/Pemilik' },
]
