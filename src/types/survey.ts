// Referensi target survey (hasil embed PostgREST).
export interface SurveyLocationRef {
  id: string
  kode: string
  nama: string
}

export interface SurveyParcelRef {
  id: string
  kode: string
  nomor_bidang: string | null
}

// Baris tabel public.surveys (AGENTS.md §8) — lokasi dan/atau bidang,
// minimal satu terisi (CHECK di database).
export interface SurveyRecord {
  id: string
  lokasi_id: string | null
  bidang_id: string | null
  tanggal_survey: string
  surveyor: string
  hasil_survey: string
  catatan: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
  lokasi: SurveyLocationRef | null
  bidang: SurveyParcelRef | null
}

export interface SurveyInput {
  lokasi_id: string | null
  bidang_id: string | null
  tanggal_survey: string
  surveyor: string
  hasil_survey: string
  catatan: string | null
  latitude: number | null
  longitude: number | null
}
