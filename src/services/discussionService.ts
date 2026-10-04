import { isServiceError, ServiceError, toServiceError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { auditService } from './auditService'
import { requireSupabase, sanitizeSearchTerm, unwrapQuery, unwrapQuerySingle, unwrapQueryWithCount } from './query'
import type { Paginated } from '../types/pagination'
import type {
  DiscussionDecision,
  DiscussionInput,
  DiscussionLocationRef,
  DiscussionParcelRef,
  DiscussionRecord,
} from '../types/discussion'

const COLUMNS =
  'id, lokasi_id, bidang_id, tanggal, peserta, hasil, keputusan, catatan, created_at, updated_at, lokasi:locations(id, kode, nama), bidang:land_parcels(id, kode, nomor_bidang)'

// supabase-js mengetip embed many-to-one sebagai array — dinormalisasi.
interface DiscussionRow
  extends Omit<DiscussionRecord, 'lokasi' | 'bidang'> {
  lokasi: DiscussionLocationRef | DiscussionLocationRef[] | null
  bidang: DiscussionParcelRef | DiscussionParcelRef[] | null
}

function toDiscussion(row: DiscussionRow): DiscussionRecord {
  return {
    ...row,
    lokasi: Array.isArray(row.lokasi) ? (row.lokasi[0] ?? null) : row.lokasi,
    bidang: Array.isArray(row.bidang) ? (row.bidang[0] ?? null) : row.bidang,
  }
}

const HISTORY_LIMIT = 50

export interface DiscussionListParams {
  // Mencari di kolom peserta, hasil.
  search?: string
  lokasiId?: string
  keputusan?: DiscussionDecision
  page?: number
  pageSize?: number
}

function validateCommon(input: { tanggal: string; peserta: string; hasil: string }): void {
  if (!input.tanggal) {
    throw new ServiceError('Tanggal wajib diisi.')
  }
  if (!input.peserta.trim()) {
    throw new ServiceError('Peserta wajib diisi.')
  }
  if (!input.hasil.trim()) {
    throw new ServiceError('Hasil pembahasan wajib diisi.')
  }
}

function validateInput(input: {
  lokasi_id: string | null
  bidang_id: string | null
  tanggal: string
  peserta: string
  hasil: string
  keputusan: DiscussionDecision
}): void {
  if (!input.lokasi_id && !input.bidang_id) {
    throw new ServiceError('Target pembahasan wajib dipilih.')
  }
  validateCommon(input)
}

export const discussionService = {
  async list(params: DiscussionListParams = {}): Promise<Paginated<DiscussionRecord>> {
    requireSupabase()
    const page = Math.max(1, Math.floor(params.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)))

    let query = supabase.from('discussions').select(COLUMNS, { count: 'exact' })

    const search = sanitizeSearchTerm(params.search ?? '')
    if (search) {
      const pattern = `%${search}%`
      query = query.or(`peserta.ilike.${pattern},hasil.ilike.${pattern}`)
    }
    if (params.lokasiId) query = query.eq('lokasi_id', params.lokasiId)
    if (params.keputusan) query = query.eq('keputusan', params.keputusan)

    query = query
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false })

    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, count } = await unwrapQueryWithCount<DiscussionRow[]>(query)
    return { data: data.map(toDiscussion), total: count, page, pageSize }
  },

  async listHistoryByLocation(locationId: string): Promise<DiscussionRecord[]> {
    requireSupabase()
    const rows =
      (await unwrapQuery<DiscussionRow[]>(
        supabase
          .from('discussions')
          .select(COLUMNS)
          .eq('lokasi_id', locationId)
          .order('tanggal', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(HISTORY_LIMIT),
      )) ?? []
    return rows.map(toDiscussion)
  },

  async listHistoryByParcel(parcelId: string): Promise<DiscussionRecord[]> {
    requireSupabase()
    const rows =
      (await unwrapQuery<DiscussionRow[]>(
        supabase
          .from('discussions')
          .select(COLUMNS)
          .eq('bidang_id', parcelId)
          .order('tanggal', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(HISTORY_LIMIT),
      )) ?? []
    return rows.map(toDiscussion)
  },

  async getById(id: string): Promise<DiscussionRecord> {
    requireSupabase()
    try {
      const row = await unwrapQuerySingle<DiscussionRow>(
        supabase.from('discussions').select(COLUMNS).eq('id', id).single(),
      )
      return toDiscussion(row)
    } catch (error) {
      if (isServiceError(error) && error.code === 'PGRST116') {
        throw new ServiceError('Pembahasan tidak ditemukan.', {
          code: 'DISCUSSION_NOT_FOUND',
          cause: error,
        })
      }
      throw error
    }
  },

  // Catat pembahasan via RPC create_pembahasan — ATOMIK: insert histori +
  // efek status target (TIDAK_LAYAK → DITOLAK, PERLU_KAJIAN → DITUNDA).
  async create(input: DiscussionInput): Promise<DiscussionRecord> {
    requireSupabase()
    validateInput(input)
    const row = await unwrapQuery<DiscussionRow>(
      supabase.rpc('create_pembahasan', {
        p_lokasi_id: input.lokasi_id,
        p_bidang_id: input.bidang_id,
        p_tanggal: input.tanggal,
        p_peserta: input.peserta.trim(),
        p_hasil: input.hasil.trim(),
        p_keputusan: input.keputusan,
        p_catatan: input.catatan?.trim() ?? null,
      }),
    )
    if (!row) throw new ServiceError('Gagal mencatat pembahasan.')
    const record = toDiscussion(row as DiscussionRow)
    auditService.log('CREATE', 'DISCUSSION', record.id, record.keputusan)
    if (record.keputusan !== 'LAYAK') {
      auditService.log(
        'STATUS_CHANGE',
        record.lokasi_id ? 'LOCATION' : 'LAND_PARCEL',
        record.lokasi_id ?? record.bidang_id ?? undefined,
        `Pembahasan ${record.keputusan} → ${record.keputusan === 'TIDAK_LAYAK' ? 'DITOLAK' : 'DITUNDA'}`,
      )
    }
    return record
  },

  // Ubah pembahasan via RPC update_pembahasan — efek status dihitung ulang
  // dari keputusan baru (target tidak berubah).
  async update(
    id: string,
    input: Pick<DiscussionInput, 'tanggal' | 'peserta' | 'hasil' | 'keputusan' | 'catatan'>,
  ): Promise<DiscussionRecord> {
    requireSupabase()
    validateCommon(input)
    if (!input.keputusan) {
      throw new ServiceError('Keputusan wajib dipilih.')
    }
    const row = await unwrapQuery<DiscussionRow>(
      supabase.rpc('update_pembahasan', {
        p_id: id,
        p_tanggal: input.tanggal,
        p_peserta: input.peserta.trim(),
        p_hasil: input.hasil.trim(),
        p_keputusan: input.keputusan,
        p_catatan: input.catatan?.trim() ?? null,
      }),
    )
    if (!row) throw new ServiceError('Gagal menyimpan pembahasan.')
    const record = toDiscussion(row as DiscussionRow)
    auditService.log('UPDATE', 'DISCUSSION', record.id, record.keputusan)
    if (record.keputusan !== 'LAYAK') {
      auditService.log(
        'STATUS_CHANGE',
        record.lokasi_id ? 'LOCATION' : 'LAND_PARCEL',
        record.lokasi_id ?? record.bidang_id ?? undefined,
        `Pembahasan ${record.keputusan} → ${record.keputusan === 'TIDAK_LAYAK' ? 'DITOLAK' : 'DITUNDA'}`,
      )
    }
    return record
  },

  async remove(id: string): Promise<void> {
    requireSupabase()
    const { data, error } = await supabase
      .from('discussions')
      .delete()
      .eq('id', id)
      .select('id')
    if (error) throw toServiceError(error)
    if (!data || data.length === 0) {
      throw new ServiceError('Pembahasan tidak ditemukan.', { code: 'DELETE_FORBIDDEN' })
    }
    auditService.log('DELETE', 'DISCUSSION', id)
  },
}
