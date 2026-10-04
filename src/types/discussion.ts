export type DiscussionDecision = 'LAYAK' | 'PERLU_KAJIAN' | 'TIDAK_LAYAK'

export const DISCUSSION_DECISIONS: DiscussionDecision[] = [
  'LAYAK',
  'PERLU_KAJIAN',
  'TIDAK_LAYAK',
]

export const DISCUSSION_DECISION_LABELS: Record<DiscussionDecision, string> = {
  LAYAK: 'Layak',
  PERLU_KAJIAN: 'Perlu Kajian',
  TIDAK_LAYAK: 'Tidak Layak',
}

// Efek keputusan terhadap status target (ditegakkan RPC, §9).
export const DISCUSSION_DECISION_EFFECTS: Record<DiscussionDecision, string> = {
  LAYAK: 'Status tidak berubah',
  PERLU_KAJIAN: 'Status target → Ditunda',
  TIDAK_LAYAK: 'Status target → Ditolak',
}

// Referensi target pembahasan (hasil embed PostgREST).
export interface DiscussionLocationRef {
  id: string
  kode: string
  nama: string
}

export interface DiscussionParcelRef {
  id: string
  kode: string
  nomor_bidang: string | null
}

// Baris tabel public.discussions (§9).
export interface DiscussionRecord {
  id: string
  lokasi_id: string | null
  bidang_id: string | null
  tanggal: string
  peserta: string
  hasil: string
  keputusan: DiscussionDecision
  catatan: string | null
  created_at: string
  updated_at: string
  lokasi: DiscussionLocationRef | null
  bidang: DiscussionParcelRef | null
}

export interface DiscussionInput {
  lokasi_id: string | null
  bidang_id: string | null
  tanggal: string
  peserta: string
  hasil: string
  keputusan: DiscussionDecision
  catatan: string | null
}
