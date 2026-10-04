import { isServiceError, ServiceError, toServiceError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { auditService } from './auditService'
import { requireSupabase, sanitizeSearchTerm, unwrapQuery, unwrapQuerySingle, unwrapQueryWithCount } from './query'
import type { Paginated } from '../types/pagination'
import type { PartyRef } from '../types/party'
import type { LegalityInput, LegalityRecord, LegalityStatus } from '../types/legality'

const COLUMNS =
  'id, bidang_id, pihak_id, jenis_dokumen, nomor_dokumen, tanggal_dokumen, penerbit, status, catatan, created_at, updated_at, pihak:parties(id, nama, nik, nomor_telepon, tipe_pihak)'

const LIST_COLUMNS =
  'id, bidang_id, jenis_dokumen, nomor_dokumen, tanggal_dokumen, penerbit, status, created_at, bidang:land_parcels(id, kode, nomor_bidang, lokasi:locations(id, kode, nama)), pihak:parties(id, nama)'

// Baris list global — embed bidang (dengan lokasinya) dan pihak.
export interface LegalityListRow {
  id: string
  bidang_id: string
  jenis_dokumen: LegalityRecord['jenis_dokumen']
  nomor_dokumen: string | null
  tanggal_dokumen: string | null
  penerbit: string | null
  status: LegalityStatus
  created_at: string
  bidang: {
    id: string
    kode: string
    nomor_bidang: string | null
    lokasi: { id: string; kode: string; nama: string } | null
  } | null
  pihak: { id: string; nama: string } | null
}

interface BidangRow {
  id: string
  kode: string
  nomor_bidang: string | null
  lokasi: { id: string; kode: string; nama: string } | { id: string; kode: string; nama: string }[] | null
}

interface PihakRow {
  id: string
  nama: string
}

interface LegalityListRowRaw extends Omit<LegalityListRow, 'bidang' | 'pihak'> {
  bidang: BidangRow | BidangRow[] | null
  pihak: PihakRow | PihakRow[] | null
}

function pick<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function toListRow(row: LegalityListRowRaw): LegalityListRow {
  const bidangRaw = pick(row.bidang)
  return {
    ...row,
    bidang: bidangRaw
      ? { ...bidangRaw, lokasi: pick(bidangRaw.lokasi) }
      : null,
    pihak: pick(row.pihak),
  }
}

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
  // List global (menu Legalitas): filter status/jenis/lokasi + pencarian
  // nomor dokumen/penerbit + pagination.
  async list(params: {
    search?: string
    status?: LegalityStatus
    jenis?: LegalityRecord['jenis_dokumen']
    lokasiId?: string
    page?: number
    pageSize?: number
  } = {}): Promise<Paginated<LegalityListRow>> {
    requireSupabase()
    const page = Math.max(1, Math.floor(params.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)))

    let query = supabase.from('legalities').select(LIST_COLUMNS, { count: 'exact' })

    const search = sanitizeSearchTerm(params.search ?? '')
    if (search) {
      const pattern = `%${search}%`
      query = query.or(`nomor_dokumen.ilike.${pattern},penerbit.ilike.${pattern}`)
    }
    if (params.status) query = query.eq('status', params.status)
    if (params.jenis) query = query.eq('jenis_dokumen', params.jenis)
    if (params.lokasiId) {
      const parcelIds =
        (await unwrapQuery<{ id: string }[]>(
          supabase.from('land_parcels').select('id').eq('lokasi_id', params.lokasiId).limit(5000),
        )) ?? []
      query = parcelIds.length > 0
        ? query.in('bidang_id', parcelIds.map((row) => row.id))
        : query.eq('bidang_id', '00000000-0000-0000-0000-000000000000')
    }

    query = query
      .order('jenis_dokumen', { ascending: true })
      .order('created_at', { ascending: false })

    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, count } = await unwrapQueryWithCount<LegalityListRowRaw[]>(query)
    return { data: data.map(toListRow), total: count, page, pageSize }
  },

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

  async getById(id: string): Promise<LegalityRecord> {
    requireSupabase()
    try {
      return toLegality(await unwrapQuerySingle<LegalityRow>(
        supabase.from('legalities').select(COLUMNS).eq('id', id).single(),
      ))
    } catch (error) {
      if (isServiceError(error) && error.code === 'PGRST116') {
        throw new ServiceError('Data legalitas tidak ditemukan.', {
          code: 'LEGALITY_NOT_FOUND',
          cause: error,
        })
      }
      throw error
    }
  },

  async create(input: LegalityInput): Promise<LegalityRecord> {
    requireSupabase()
    const row = toLegality(await unwrapQuerySingle<LegalityRow>(
      supabase.from('legalities').insert(mapInputToRow(input)).select(COLUMNS).single(),
    ))
    auditService.log('CREATE', 'LEGALITY', row.id, row.jenis_dokumen)
    return row
  },

  async update(id: string, input: Partial<LegalityInput>): Promise<LegalityRecord> {
    requireSupabase()
    const patch = mapInputToRow(input)
    if (Object.keys(patch).length === 0) {
      throw new ServiceError('Tidak ada perubahan yang disimpan.')
    }
    const row = toLegality(await unwrapQuerySingle<LegalityRow>(
      supabase.from('legalities').update(patch).eq('id', id).select(COLUMNS).single(),
    ))
    auditService.log('UPDATE', 'LEGALITY', row.id, row.jenis_dokumen)
    if (input.status !== undefined) auditService.log('STATUS_CHANGE', 'LEGALITY', row.id, row.jenis_dokumen + ' -> ' + row.status)
    return row
  },

  async remove(id: string): Promise<void> {
    requireSupabase()
    const { data, error } = await supabase.from('legalities').delete().eq('id', id).select('id')
    if (error) throw toServiceError(error)
    if (!data || data.length === 0) {
      throw new ServiceError('Data legalitas tidak ditemukan.', { code: 'DELETE_FORBIDDEN' })
    }
    auditService.log('DELETE', 'LEGALITY', id)
  },
}
