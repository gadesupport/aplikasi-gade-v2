import { ServiceError, toServiceError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { requireSupabase, unwrapQuery, unwrapQuerySingle } from './query'
import type { PartyRef } from '../types/party'
import type { LegalityInput, LegalityRecord } from '../types/legality'

const COLUMNS =
  'id, bidang_id, pihak_id, jenis_dokumen, nomor_dokumen, tanggal_dokumen, penerbit, status, catatan, created_at, updated_at, pihak:parties(id, nama, nik, nomor_telepon, tipe_pihak)'

// supabase-js mengetip embed many-to-one sebagai array meskipun runtime
// mengembalikan objek tunggal — dinormalisasi lewat toLegality().
interface LegalityRow extends Omit<LegalityRecord, 'pihak'> {
  pihak: PartyRef | PartyRef[] | null
}

function toLegality(row: LegalityRow): LegalityRecord {
  return {
    ...row,
    pihak: Array.isArray(row.pihak) ? (row.pihak[0] ?? null) : row.pihak,
  }
}

function mapInputToRow(input: Partial<LegalityInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (input.bidang_id !== undefined) row.bidang_id = input.bidang_id
  if (input.pihak_id !== undefined) row.pihak_id = input.pihak_id || null
  if (input.jenis_dokumen !== undefined) row.jenis_dokumen = input.jenis_dokumen
  if (input.nomor_dokumen !== undefined) row.nomor_dokumen = input.nomor_dokumen?.trim() || null
  if (input.tanggal_dokumen !== undefined) row.tanggal_dokumen = input.tanggal_dokumen || null
  if (input.penerbit !== undefined) row.penerbit = input.penerbit?.trim() || null
  if (input.status !== undefined) row.status = input.status
  if (input.catatan !== undefined) row.catatan = input.catatan?.trim() || null
  return row
}

export const legalityService = {
  // Semua baris legalitas satu bidang (checklist mengagregasi per jenis).
  async listByParcel(bidangId: string): Promise<LegalityRecord[]> {
    requireSupabase()
    const rows =
      (await unwrapQuery<LegalityRow[]>(
        supabase
          .from('legalities')
          .select(COLUMNS)
          .eq('bidang_id', bidangId)
          .order('jenis_dokumen', { ascending: true })
          .order('created_at', { ascending: true }),
      )) ?? []
    return rows.map(toLegality)
  },

  async create(input: LegalityInput): Promise<LegalityRecord> {
    requireSupabase()
    const row = await unwrapQuerySingle<LegalityRow>(
      supabase.from('legalities').insert(mapInputToRow(input)).select(COLUMNS).single(),
    )
    return toLegality(row)
  },

  async update(id: string, input: Partial<LegalityInput>): Promise<LegalityRecord> {
    requireSupabase()
    const patch = mapInputToRow(input)
    if (Object.keys(patch).length === 0) {
      throw new ServiceError('Tidak ada perubahan yang disimpan.')
    }
    const row = await unwrapQuerySingle<LegalityRow>(
      supabase.from('legalities').update(patch).eq('id', id).select(COLUMNS).single(),
    )
    return toLegality(row)
  },

  async remove(id: string): Promise<void> {
    requireSupabase()
    const { data, error } = await supabase.from('legalities').delete().eq('id', id).select('id')
    if (error) throw toServiceError(error)
    if (!data || data.length === 0) {
      throw new ServiceError('Data legalitas tidak ditemukan.', { code: 'DELETE_FORBIDDEN' })
    }
  },
}
