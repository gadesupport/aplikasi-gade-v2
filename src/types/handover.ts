export type HandoverType = 'BERKAS_MASUK' | 'BERKAS_KELUAR' | 'BERKAS_KEMBALI'

export const HANDOVER_TYPES: HandoverType[] = ['BERKAS_MASUK', 'BERKAS_KELUAR', 'BERKAS_KEMBALI']

export const HANDOVER_TYPE_LABELS: Record<HandoverType, string> = {
  BERKAS_MASUK: 'Berkas Masuk',
  BERKAS_KELUAR: 'Berkas Keluar',
  BERKAS_KEMBALI: 'Berkas Kembali',
}

// Referensi relasi arsip (embed bersarang hasil PostgREST).
export interface HandoverLocationRef {
  id: string
  kode: string
  nama: string
}

export interface HandoverParcelRef {
  id: string
  kode: string
  nomor_bidang: string | null
}

export interface HandoverProjectRef {
  id: string
  kode: string
  nama: string
}

// Referensi arsip pada serah terima — termasuk lokasi fisik dan relasi
// (lokasi/bidang/project) untuk keperluan cetak tanda terima (§14).
export interface HandoverArchiveRef {
  id: string
  kode: string
  nama_dokumen: string
  gudang: string | null
  rak: string | null
  box: string | null
  folder: string | null
  status: string
  locations: HandoverLocationRef | null
  land_parcels: HandoverParcelRef | null
  projects: HandoverProjectRef | null
}

// Baris tabel public.handovers (AGENTS.md §14) — histori permanen;
// nomor dibuat otomatis server-side.
export interface HandoverRecord {
  id: string
  nomor: string
  archive_id: string
  tanggal: string
  jenis: HandoverType
  dari: string
  kepada: string
  keperluan: string | null
  catatan: string | null
  created_by: string | null
  created_at: string
  archives: HandoverArchiveRef | null
}
