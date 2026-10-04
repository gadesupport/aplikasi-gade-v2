import { isServiceError, ServiceError, toServiceError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { requireSupabase, sanitizeSearchTerm, unwrapQuery, unwrapQuerySingle, unwrapQueryWithCount } from './query'
import { auditService } from './auditService'
import type { Paginated } from '../types/pagination'
import type { ProjectInput, ProjectRecord, ProjectStatus } from '../types/project'

const COLUMNS =
  'id, kode, nama, lokasi, desa, kecamatan, kabupaten, status, keterangan, created_at, updated_at'

const SORT_FIELDS = ['kode', 'nama', 'created_at', 'updated_at'] as const
export type ProjectSortField = (typeof SORT_FIELDS)[number]

export interface ProjectListParams {
  // Mencari di kolom kode, nama, desa, kecamatan, kabupaten.
  search?: string
  status?: ProjectStatus
  page?: number
  pageSize?: number
  sortBy?: ProjectSortField
  sortDir?: 'asc' | 'desc'
}

const KODE_PATTERN = /^PRJ-[0-9]{4}-[0-9]{3}$/

function mapInputToRow(input: Partial<ProjectInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (input.kode !== undefined) row.kode = input.kode.trim().toUpperCase()
  if (input.nama !== undefined) row.nama = input.nama.trim()
  if (input.lokasi !== undefined) row.lokasi = input.lokasi?.trim() || null
  if (input.desa !== undefined) row.desa = input.desa?.trim() || null
  if (input.kecamatan !== undefined) row.kecamatan = input.kecamatan?.trim() || null
  if (input.kabupaten !== undefined) row.kabupaten = input.kabupaten?.trim() || null
  if (input.status !== undefined) row.status = input.status
  if (input.keterangan !== undefined) row.keterangan = input.keterangan?.trim() || null
  return row
}

function validateInput(input: Partial<ProjectInput>): void {
  if (input.kode !== undefined) {
    const kode = input.kode.trim().toUpperCase()
    if (!kode) throw new ServiceError('Kode project wajib diisi.')
    if (!KODE_PATTERN.test(kode)) {
      throw new ServiceError('Format kode harus PRJ-YYYY-NNN (contoh: PRJ-2026-001).')
    }
  }
  if (input.nama !== undefined && !input.nama.trim()) {
    throw new ServiceError('Nama project wajib diisi.')
  }
}

export const projectService = {
  async list(params: ProjectListParams = {}): Promise<Paginated<ProjectRecord>> {
    requireSupabase()
    const page = Math.max(1, Math.floor(params.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)))
    const sortBy: ProjectSortField = params.sortBy ?? 'created_at'
    const sortDir = params.sortDir ?? 'desc'

    let query = supabase.from('projects').select(COLUMNS, { count: 'exact' })

    const search = sanitizeSearchTerm(params.search ?? '')
    if (search) {
      const pattern = `%${search}%`
      query = query.or(
        `kode.ilike.${pattern},nama.ilike.${pattern},desa.ilike.${pattern},kecamatan.ilike.${pattern},kabupaten.ilike.${pattern}`,
      )
    }
    if (params.status) query = query.eq('status', params.status)

    query = query.order(sortBy, { ascending: sortDir === 'asc' })

    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, count } = await unwrapQueryWithCount<ProjectRecord[]>(query)
    return { data, total: count, page, pageSize }
  },

  async getById(id: string): Promise<ProjectRecord> {
    requireSupabase()
    try {
      return await unwrapQuerySingle<ProjectRecord>(
        supabase.from('projects').select(COLUMNS).eq('id', id).single(),
      )
    } catch (error) {
      if (isServiceError(error) && error.code === 'PGRST116') {
        throw new ServiceError('Project tidak ditemukan.', {
          code: 'PROJECT_NOT_FOUND',
          cause: error,
        })
      }
      throw error
    }
  },

  async create(input: ProjectInput): Promise<ProjectRecord> {
    requireSupabase()
    validateInput(input)
    try {
      const row = await unwrapQuerySingle<ProjectRecord>(
        supabase.from('projects').insert(mapInputToRow(input)).select(COLUMNS).single(),
      )
      auditService.log('CREATE', 'PROJECT', row.id, row.kode)
      return row
    } catch (error) {
      if (isServiceError(error) && error.code === '23505') {
        throw new ServiceError('Kode project sudah digunakan.', {
          code: 'KODE_DUPLICATE',
          cause: error,
        })
      }
      throw error
    }
  },

  async update(id: string, input: Partial<ProjectInput>): Promise<ProjectRecord> {
    requireSupabase()
    const patch = mapInputToRow(input)
    if (Object.keys(patch).length === 0) {
      throw new ServiceError('Tidak ada perubahan yang disimpan.')
    }
    validateInput(input)
    try {
      const row = await unwrapQuerySingle<ProjectRecord>(
        supabase.from('projects').update(patch).eq('id', id).select(COLUMNS).single(),
      )
      auditService.log('UPDATE', 'PROJECT', row.id, row.kode)
      if (input.status !== undefined) auditService.log('STATUS_CHANGE', 'PROJECT', row.id, row.kode + ' -> ' + row.status)
      return row
    } catch (error) {
      if (isServiceError(error) && error.code === '23505') {
        throw new ServiceError('Kode project sudah digunakan.', {
          code: 'KODE_DUPLICATE',
          cause: error,
        })
      }
      throw error
    }
  },

  // Opsi project (ringkas) untuk dropdown relasi arsip.
  async listOptions(): Promise<{ id: string; kode: string; nama: string }[]> {
    requireSupabase()
    return (
      (await unwrapQuery<{ id: string; kode: string; nama: string }[]>(
        supabase
          .from('projects')
          .select('id, kode, nama')
          .order('nama', { ascending: true })
          .limit(500),
      )) ?? []
    )
  },

  async remove(id: string): Promise<void> {
    requireSupabase()
    // .select('id') agar bisa dibedakan: tidak ada baris terhapus berarti
    // project tidak ada, atau RLS (bukan ADMIN/SUPERADMIN) memblokir delete.
    const { data, error } = await supabase.from('projects').delete().eq('id', id).select('id')
    if (error) throw toServiceError(error)
    if (!data || data.length === 0) {
      throw new ServiceError(
        'Project tidak ditemukan atau Anda tidak memiliki izin menghapusnya.',
        { code: 'DELETE_FORBIDDEN' },
      )
    }
    auditService.log('DELETE', 'PROJECT', id)
  },
}
