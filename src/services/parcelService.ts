import { isServiceError, ServiceError, toServiceError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { requireSupabase, sanitizeSearchTerm, unwrapQuery, unwrapQuerySingle, unwrapQueryWithCount } from './query'
import { auditService } from './auditService'
import type { Paginated } from '../types/pagination'
import type { ParcelInput, ParcelStatus, ParcelWithLocation } from '../types/parcel'
import type { ParcelLocationRef } from '../types/parcel'

const COLUMNS =
  'id, lokasi_id, kode, nomor_bidang, luas, jenis_hak, nomor_hak, status_pembebasan, harga_penawaran, harga_kesepakatan, tanggal_kesepakatan, catatan, created_at, updated_at, lokasi:locations(id, kode, nama)'

// supabase-js mengetip embed many-to-one sebagai array meskipun runtime
// mengembalikan objek tunggal — dinormalisasi lewat toParcel().
interface ParcelRow extends Omit<ParcelWithLocation, 'lokasi'> {
  lokasi: ParcelLocationRef | ParcelLocationRef[] | null
}

function toParcel(row: ParcelRow): ParcelWithLocation {
  return {
    ...row,
    lokasi: Array.isArray(row.lokasi) ? (row.lokasi[0] ?? null) : row.lokasi,
  }
}

const SORT_FIELDS = ['kode', 'luas', 'tanggal_kesepakatan', 'created_at', 'updated_at'] as const
export type ParcelSortField = (typeof SORT_FIELDS)[number]

export interface ParcelOption {
  id: string
  kode: string
  nomor_bidang: string | null
  lokasi: ParcelLocationRef | null
}

export interface ParcelListParams {
  // Mencari di kolom kode, nomor_bidang, nomor_hak.
  search?: string
  status?: ParcelStatus
  lokasiId?: string
  page?: number
  pageSize?: number
  sortBy?: ParcelSortField
  sortDir?: 'asc' | 'desc'
}

// Batas aman daftar bidang per lokasi (section di halaman detail lokasi).
const BY_LOCATION_LIMIT = 1000

function mapInputToRow(input: Partial<ParcelInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (input.lokasi_id !== undefined) row.lokasi_id = input.lokasi_id
  if (input.kode !== undefined) row.kode = input.kode.trim().toUpperCase()
  if (input.nomor_bidang !== undefined) row.nomor_bidang = input.nomor_bidang?.trim() || null
  if (input.luas !== undefined) row.luas = input.luas
  if (input.jenis_hak !== undefined) row.jenis_hak = input.jenis_hak?.trim() || null
  if (input.nomor_hak !== undefined) row.nomor_hak = input.nomor_hak?.trim() || null
  if (input.status_pembebasan !== undefined) row.status_pembebasan = input.status_pembebasan
  if (input.harga_penawaran !== undefined) row.harga_penawaran = input.harga_penawaran
  if (input.harga_kesepakatan !== undefined) row.harga_kesepakatan = input.harga_kesepakatan
  if (input.tanggal_kesepakatan !== undefined) {
    row.tanggal_kesepakatan = input.tanggal_kesepakatan || null
  }
  if (input.catatan !== undefined) row.catatan = input.catatan?.trim() || null
  return row
}

function validateRequired(input: Partial<ParcelInput>): void {
  if (input.lokasi_id !== undefined && !input.lokasi_id.trim()) {
    throw new ServiceError('Lokasi induk wajib dipilih.')
  }
  if (input.kode !== undefined && !input.kode.trim()) {
    throw new ServiceError('Kode bidang wajib diisi.')
  }
}

export const parcelService = {
  async list(params: ParcelListParams = {}): Promise<Paginated<ParcelWithLocation>> {
    requireSupabase()
    const page = Math.max(1, Math.floor(params.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)))
    const sortBy: ParcelSortField = params.sortBy ?? 'created_at'
    const sortDir = params.sortDir ?? 'desc'

    let query = supabase.from('land_parcels').select(COLUMNS, { count: 'exact' })

    const search = sanitizeSearchTerm(params.search ?? '')
    if (search) {
      const pattern = `%${search}%`
      query = query.or(
        `kode.ilike.${pattern},nomor_bidang.ilike.${pattern},nomor_hak.ilike.${pattern}`,
      )
    }
    if (params.status) query = query.eq('status_pembebasan', params.status)
    if (params.lokasiId) query = query.eq('lokasi_id', params.lokasiId)

    query = query.order(sortBy, { ascending: sortDir === 'asc' })

    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, count } = await unwrapQueryWithCount<ParcelRow[]>(query)
    return { data: data.map(toParcel), total: count, page, pageSize }
  },

  // Daftar bidang untuk satu lokasi (halaman detail lokasi).
  async listByLocation(locationId: string): Promise<ParcelWithLocation[]> {
    requireSupabase()
    const rows =
      (await unwrapQuery<ParcelRow[]>(
        supabase
          .from('land_parcels')
          .select(COLUMNS)
          .eq('lokasi_id', locationId)
          .order('kode', { ascending: true })
          .limit(BY_LOCATION_LIMIT),
      )) ?? []
    return rows.map(toParcel)
  },

  // Opsi bidang (ringkas, dengan referensi lokasi) untuk dropdown form survey.
  async listOptions(): Promise<ParcelOption[]> {
    requireSupabase()
    // Select minim — barisnya bukan ParcelRow penuh.
    interface ParcelOptionRow {
      id: string
      kode: string
      nomor_bidang: string | null
      lokasi: ParcelLocationRef | ParcelLocationRef[] | null
    }
    const rows =
      (await unwrapQuery<ParcelOptionRow[]>(
        supabase
          .from('land_parcels')
          .select('id, kode, nomor_bidang, lokasi:locations(id, kode, nama)')
          .order('kode', { ascending: true })
          .limit(500),
      )) ?? []
    return rows.map((row) => ({
      id: row.id,
      kode: row.kode,
      nomor_bidang: row.nomor_bidang,
      lokasi: Array.isArray(row.lokasi) ? (row.lokasi[0] ?? null) : row.lokasi,
    }))
  },

  async getById(id: string): Promise<ParcelWithLocation> {
    requireSupabase()
    try {
      const row = await unwrapQuerySingle<ParcelRow>(
        supabase.from('land_parcels').select(COLUMNS).eq('id', id).single(),
      )
      return toParcel(row)
    } catch (error) {
      if (isServiceError(error) && error.code === 'PGRST116') {
        throw new ServiceError('Bidang tanah tidak ditemukan.', {
          code: 'PARCEL_NOT_FOUND',
          cause: error,
        })
      }
      throw error
    }
  },

  async create(input: ParcelInput): Promise<ParcelWithLocation> {
    requireSupabase()
    validateRequired(input)
    const created = await unwrapQuerySingle<ParcelRow>(
      supabase.from('land_parcels').insert(mapInputToRow(input)).select(COLUMNS).single(),
    )
    const row = toParcel(created)
    auditService.log('CREATE', 'LAND_PARCEL', row.id, row.kode)
    if (input.status_pembebasan !== undefined) {
      auditService.log('STATUS_CHANGE', 'LAND_PARCEL', row.id, row.kode + ' -> ' + row.status_pembebasan)
    }
    return row
  },

  async update(id: string, input: Partial<ParcelInput>): Promise<ParcelWithLocation> {
    requireSupabase()
    const patch = mapInputToRow(input)
    if (Object.keys(patch).length === 0) {
      throw new ServiceError('Tidak ada perubahan yang disimpan.')
    }
    validateRequired(input)
    const created = await unwrapQuerySingle<ParcelRow>(
      supabase.from('land_parcels').update(patch).eq('id', id).select(COLUMNS).single(),
    )
    const row = toParcel(created)
    auditService.log('UPDATE', 'LAND_PARCEL', row.id, row.kode)
    if (input.status_pembebasan !== undefined) auditService.log('STATUS_CHANGE', 'LAND_PARCEL', row.id, row.kode + ' -> ' + row.status_pembebasan)
    return row
  },

  async remove(id: string): Promise<void> {
    requireSupabase()
    // .select('id') agar bisa dibedakan: tidak ada baris terhapus berarti
    // bidang tidak ada, atau RLS (bukan ADMIN/SUPERADMIN) memblokir delete.
    const { data, error } = await supabase.from('land_parcels').delete().eq('id', id).select('id')
    if (error) throw toServiceError(error)
    if (!data || data.length === 0) {
      throw new ServiceError(
        'Bidang tanah tidak ditemukan atau Anda tidak memiliki izin menghapusnya.',
        { code: 'DELETE_FORBIDDEN' },
      )
    }
    auditService.log('DELETE', 'LAND_PARCEL', id)
  },
}
