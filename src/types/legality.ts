import type { PartyRef } from './party'

export type LegalityStatus = 'ADA' | 'BELUM_ADA' | 'PROSES' | 'TIDAK_RELEVAN' | 'PERLU_VERIFIKASI'

export const LEGALITY_STATUSES: LegalityStatus[] = [
  'ADA',
  'BELUM_ADA',
  'PROSES',
  'TIDAK_RELEVAN',
  'PERLU_VERIFIKASI',
]

export const LEGALITY_STATUS_LABELS: Record<LegalityStatus, string> = {
  ADA: 'Ada',
  BELUM_ADA: 'Belum Ada',
  PROSES: 'Proses',
  TIDAK_RELEVAN: 'Tidak Relevan',
  PERLU_VERIFIKASI: 'Perlu Verifikasi',
}

export type LegalityDocType =
  | 'SERTIFIKAT'
  | 'SHM'
  | 'SHGB'
  | 'AJB'
  | 'KTP'
  | 'KK'
  | 'PBB'
  | 'SPPT'
  | 'GIRIK'
  | 'LETTER_C'
  | 'SURAT_WARIS'
  | 'AKTA_WARIS'
  | 'SURAT_KUASA'
  | 'LAINNYA'

export const LEGALITY_DOC_TYPES: LegalityDocType[] = [
  'SERTIFIKAT',
  'SHM',
  'SHGB',
  'AJB',
  'KTP',
  'KK',
  'PBB',
  'SPPT',
  'GIRIK',
  'LETTER_C',
  'SURAT_WARIS',
  'AKTA_WARIS',
  'SURAT_KUASA',
  'LAINNYA',
]

export const LEGALITY_DOC_TYPE_LABELS: Record<LegalityDocType, string> = {
  SERTIFIKAT: 'Sertifikat',
  SHM: 'SHM',
  SHGB: 'SHGB',
  AJB: 'AJB',
  KTP: 'KTP',
  KK: 'Kartu Keluarga',
  PBB: 'PBB',
  SPPT: 'SPPT',
  GIRIK: 'Girik',
  LETTER_C: 'Letter C',
  SURAT_WARIS: 'Surat Waris',
  AKTA_WARIS: 'Akta Waris',
  SURAT_KUASA: 'Surat Kuasa',
  LAINNYA: 'Dokumen Lainnya',
}

// Baris tabel public.legalities.
export interface LegalityRecord {
  id: string
  bidang_id: string
  pihak_id: string | null
  jenis_dokumen: LegalityDocType
  nomor_dokumen: string | null
  tanggal_dokumen: string | null
  penerbit: string | null
  status: LegalityStatus
  catatan: string | null
  created_at: string
  updated_at: string
  pihak: PartyRef | null
}

export interface LegalityInput {
  bidang_id: string
  pihak_id: string | null
  jenis_dokumen: LegalityDocType
  nomor_dokumen: string | null
  tanggal_dokumen: string | null
  penerbit: string | null
  status: LegalityStatus
  catatan: string | null
}
