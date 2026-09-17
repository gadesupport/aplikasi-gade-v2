import { isServiceError, ServiceError, toServiceError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import {
  requireSupabase,
  sanitizeSearchTerm,
  unwrapQuery,
  unwrapQuerySingle,
  unwrapQueryWithCount,
} from './query'
import type { Paginated } from '../types/pagination'
import type { LocationInput, LocationRecord, LocationStatus } from '../types/location'

const COLUMNS =
  'id, kode, nama, alamat, desa, kecamatan, kabupaten, luas_target, luas_teridentifikasi, luas_deal, peruntukan, kondisi_lahan, kondisi_pasar, catatan, status, created_at, updated_at'

const SORT_FIELDS = ['kode', 'nama', 'created_at', 'updated_at'] as const
export type LocationSortField = (typeof SORT_FIELDS)[number]

export interface LocationListParams {
  // Mencari di kolom kode, nama, desa, kecamatan, kabupaten.
  search?: string
  status?: LocationStatus
  kabupaten?: string
  page?: number
  pageSize?: number
  sortBy?: LocationSortField
  sortDir?: 'asc' | 'desc'
}

export interface LocationOption {
  id: string
  kode: string
  nama: string
}

function mapInputToRow(input: Partial<LocationInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (input.kode !== undefined) row.kode = input.kode.trim().toUpperCase()
  if (input.nama !== undefined) row.nama = input.nama.trim()
  if (input.alamat !== undefined) row.alamat = input.alamat?.trim() || null
  if (input.desa !== undefined) row.desa = input.desa?.trim() || null
  if (input.kecamatan !== undefined) row.kecamatan = input.kecamatan?.trim() || null
  if (input.kabupaten !== undefined) row.kabupaten = input.kabupaten?.trim() || null
  if (input.luas_target !== undefined) row.luas_target = input.luas_target
  if (input.luas_teridentifikasi !== undefined) row.luas_teridentifikasi = input.luas_teridentifikasi
  if (input.luas_deal !== undefined) row.luas_deal = input.luas_deal
  if (input.peruntukan !== undefined) row.peruntukan = input.peruntukan?.trim() || null
  if (input.kondisi_lahan !== undefined) row.kondisi_lahan = input.kondisi_lahan?.trim() || null
  if (input.kondisi_pasar !== undefined) row.kondisi_pasar = input.kondisi_pasar?.trim() || null
  if (input.catatan !== undefined) row.catatan = input.catatan?.trim() || null
  if (input.status !== undefined) row.status = input.status
  return row
}

function validateRequiredText(input: Partial<LocationInput>): void {
  if (input.kode !== undefined && !input.kode.trim()) {
    throw new ServiceError('Kode lokasi wajib diisi.')
  }
  if (input.nama !== undefined && !input.nama.trim()) {
    throw new ServiceError('Nama lokasi wajib diisi.')
  }
}

export const locationService = {
  async list(params: LocationListParams = {}): Promise<Paginated<LocationRecord>> {
    requireSupabase()
    const page = Math.max(1, Math.floor(params.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)))
    const sortBy: LocationSortField = params.sortBy ?? 'created_at'
    const sortDir = params.sortDir ?? 'desc'

    let query = supabase.from('locations').select(COLUMNS, { count: 'exact' })

    const search = sanitizeSearchTerm(params.search ?? '')
    if (search) {
      const pattern = `%${search}%`
      query = query.or(
        `kode.ilike.${pattern},nama.ilike.${pattern},desa.ilike.${pattern},kecamatan.ilike.${pattern},kabupaten.ilike.${pattern}`,
      )
    }
    if (params.status) query = query.eq('status', params.status)
    if (params.kabupaten) query = query.ilike('kabupaten', params.kabupaten.trim())

    query = query.order(sortBy, { ascending: sortDir === 'asc' })

    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, count } = await unwrapQueryWithCount<LocationRecord[]>(query)
    return { data, total: count, page, pageSize }
  },

  // Opsi lokasi (id/kode/nama) untuk dropdown filter & form bidang.
  async listOptions(): Promise<LocationOption[]> {
    requireSupabase()
    return (
      (await unwrapQuery<LocationOption[]>(
        supabase
          .from('locations')
          .select('id, kode, nama')
          .order('nama', { ascending: true })
          .limit(500),
      )) ?? []
    )
  },

  async getById(id: string): Promise<LocationRecord> {
    requireSupabase()
    try {
      return await unwrapQuerySingle<LocationRecord>(
        supabase.from('locations').select(COLUMNS).eq('id', id).single(),
      )
    } catch (error) {
      if (isServiceError(error) && error.code === 'PGRST116') {
        throw new ServiceError('Lokasi tidak ditemukan.', {
          code: 'LOCATION_NOT_FOUND',
          cause: error,
        })
      }
      throw error
    }
  },

  async create(input: LocationInput): Promise<LocationRecord> {
    requireSupabase()
    validateRequiredText(input)
    return unwrapQuerySingle<LocationRecord>(
      supabase.from('locations').insert(mapInputToRow(input)).select(COLUMNS).single(),
    )
  },

  async update(id: string, input: Partial<LocationInput>): Promise<LocationRecord> {
    requireSupabase()
    const patch = mapInputToRow(input)
    if (Object.keys(patch).length === 0) {
      throw new ServiceError('Tidak ada perubahan yang disimpan.')
    }
    validateRequiredText(input)
    return unwrapQuerySingle<LocationRecord>(
      supabase.from('locations').update(patch).eq('id', id).select(COLUMNS).single(),
    )
  },

  async remove(id: string): Promise<void> {
    requireSupabase()
    // .select('id') agar bisa dibedakan: tidak ada baris terhapus berarti
    // lokasi tidak ada, atau RLS (bukan ADMIN/SUPERADMIN) memblokir delete.
    const { data, error } = await supabase.from('locations').delete().eq('id', id).select('id')
    if (error) throw toServiceError(error)
    if (!data || data.length === 0) {
      throw new ServiceError('Lokasi tidak ditemukan atau Anda tidak memiliki izin menghapusnya.', {
        code: 'DELETE_FORBIDDEN',
      })
    }
  },
}
