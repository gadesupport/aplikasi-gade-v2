export type PartyType = 'PEMEGANG_HAK' | 'AHLI_WARIS' | 'KUASA' | 'PENGUASA' | 'PIHAK_LAIN'

export const PARTY_TYPES: PartyType[] = [
  'PEMEGANG_HAK',
  'AHLI_WARIS',
  'KUASA',
  'PENGUASA',
  'PIHAK_LAIN',
]

export const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  PEMEGANG_HAK: 'Pemegang Hak',
  AHLI_WARIS: 'Ahli Waris',
  KUASA: 'Kuasa',
  PENGUASA: 'Penguasa',
  PIHAK_LAIN: 'Pihak Lain',
}

// Saran peran pihak pada sebuah bidang (datalist) — bukan konstrain database.
export const PERAN_SUGGESTIONS = [
  'Pemilik',
  'Ahli Waris',
  'Kuasa Jual',
  'Penguasa',
  'Penjamin',
  'Saksi',
]

// Baris tabel public.parties.
export interface PartyRecord {
  id: string
  nama: string
  nik: string | null
  alamat: string | null
  nomor_telepon: string | null
  tipe_pihak: PartyType
  catatan: string | null
  created_at: string
  updated_at: string
}

export interface PartyInput {
  nama: string
  nik: string | null
  alamat: string | null
  nomor_telepon: string | null
  tipe_pihak: PartyType
  catatan: string | null
}

// Referensi pihak pada relasi bidang (hasil embed PostgREST).
export interface PartyRef {
  id: string
  nama: string
  nik: string | null
  nomor_telepon: string | null
  tipe_pihak: PartyType
}

// Baris tabel public.parcel_parties.
export interface ParcelPartyRecord {
  id: string
  parcel_id: string
  party_id: string
  peran: string | null
  keterangan: string | null
  created_at: string
  updated_at: string
}

export interface ParcelPartyWithParty extends ParcelPartyRecord {
  party: PartyRef | null
}

export interface ParcelPartyInput {
  parcel_id: string
  party_id: string
  peran: string | null
  keterangan: string | null
}
