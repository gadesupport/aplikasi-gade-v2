export type ArchiveRelationType = 'LOCATION' | 'PARCEL' | 'PROJECT' | 'GENERAL'

export const ARCHIVE_RELATION_TYPES: ArchiveRelationType[] = [
  'LOCATION',
  'PARCEL',
  'PROJECT',
  'GENERAL',
]

export const ARCHIVE_RELATION_LABELS: Record<ArchiveRelationType, string> = {
  LOCATION: 'Lokasi',
  PARCEL: 'Bidang',
  PROJECT: 'Project',
  GENERAL: 'Umum',
}

export type ArchiveStatus = 'TERSEDIA' | 'DIPINJAM' | 'HILANG' | 'RUSAK' | 'DIARSIPKAN'

export const ARCHIVE_STATUSES: ArchiveStatus[] = [
  'TERSEDIA',
  'DIPINJAM',
  'HILANG',
  'RUSAK',
  'DIARSIPKAN',
]

export const ARCHIVE_STATUS_LABELS: Record<ArchiveStatus, string> = {
  TERSEDIA: 'Tersedia',
  DIPINJAM: 'Dipinjam',
  HILANG: 'Hilang',
  RUSAK: 'Rusak',
  DIARSIPKAN: 'Diarsipkan',
}

// Referensi target relasi (hasil embed PostgREST).
export interface ArchiveLocationRef {
  id: string
  kode: string
  nama: string
}

export interface ArchiveParcelRef {
  id: string
  kode: string
  nomor_bidang: string | null
}

export interface ArchiveProjectRef {
  id: string
  kode: string
  nama: string
}

// Baris tabel public.archives (AGENTS.md §12) — relasi tegas satu target
// sesuai tipe, atau tanpa target bila GENERAL.
export interface ArchiveRecord {
  id: string
  kode: string
  nama_dokumen: string
  kategori: string | null
  jenis_dokumen: string | null
  nomor_dokumen: string | null
  tanggal_dokumen: string | null
  tipe_relasi: ArchiveRelationType
  location_id: string | null
  parcel_id: string | null
  project_id: string | null
  gudang: string | null
  rak: string | null
  box: string | null
  folder: string | null
  status: ArchiveStatus
  catatan: string | null
  created_at: string
  updated_at: string
  locations: ArchiveLocationRef | null
  land_parcels: ArchiveParcelRef | null
  projects: ArchiveProjectRef | null
}

export interface ArchiveInput {
  kode: string
  nama_dokumen: string
  kategori: string | null
  jenis_dokumen: string | null
  nomor_dokumen: string | null
  tanggal_dokumen: string | null
  tipe_relasi: ArchiveRelationType
  location_id: string | null
  parcel_id: string | null
  project_id: string | null
  gudang: string | null
  rak: string | null
  box: string | null
  folder: string | null
  status: ArchiveStatus
  catatan: string | null
}
