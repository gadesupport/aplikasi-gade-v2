export type ProjectStatus = 'PERENCANAAN' | 'BERJALAN' | 'SELESAI' | 'DIBATALKAN'

export const PROJECT_STATUSES: ProjectStatus[] = [
  'PERENCANAAN',
  'BERJALAN',
  'SELESAI',
  'DIBATALKAN',
]

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PERENCANAAN: 'Perencanaan',
  BERJALAN: 'Berjalan',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
}

// Baris tabel public.projects (AGENTS.md §11) — "lokasi" adalah teks
// alamat, bukan FK ke tabel locations.
export interface ProjectRecord {
  id: string
  kode: string
  nama: string
  lokasi: string | null
  desa: string | null
  kecamatan: string | null
  kabupaten: string | null
  status: ProjectStatus
  keterangan: string | null
  created_at: string
  updated_at: string
}

export interface ProjectInput {
  kode: string
  nama: string
  lokasi: string | null
  desa: string | null
  kecamatan: string | null
  kabupaten: string | null
  status: ProjectStatus
  keterangan: string | null
}
