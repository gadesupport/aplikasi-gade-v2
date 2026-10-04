import { isServiceError, ServiceError, toServiceError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { requireSupabase, sanitizeSearchTerm, unwrapQuerySingle, unwrapQueryWithCount } from './query'
import { auditService } from './auditService'
import type { Paginated } from '../types/pagination'
import type {
  ArchiveInput,
  ArchiveLocationRef,
  ArchiveParcelRef,
  ArchiveProjectRef,
  ArchiveRecord,
  ArchiveRelationType,
  ArchiveStatus,
} from '../types/archive'

const COLUMNS =
  'id, kode, nama_dokumen, kategori, jenis_dokumen, nomor_dokumen, tanggal_dokumen, tipe_relasi, location_id, parcel_id, project_id, gudang, rak, box, folder, status, catatan, created_at, updated_at, locations(id, kode, nama), land_parcels(id, kode, nomor_bidang), projects(id, kode, nama)'

// supabase-js mengetip embed many-to-one sebagai array — dinormalisasi.
interface ArchiveRow extends Omit<ArchiveRecord, 'locations' | 'land_parcels' | 'projects'> {
  locations: ArchiveLocationRef | ArchiveLocationRef[] | null
  land_parcels: ArchiveParcelRef | ArchiveParcelRef[] | null
  projects: ArchiveProjectRef | ArchiveProjectRef[] | null
}

function pick<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function toArchive(row: ArchiveRow): ArchiveRecord {
  return {
    ...row,
    locations: pick(row.locations),
    land_parcels: pick(row.land_parcels),
    projects: pick(row.projects),
  }
}

const SORT_FIELDS = ['kode', 'nama_dokumen', 'created_at', 'updated_at'] as const
export type ArchiveSortField = (typeof SORT_FIELDS)[number]

export interface ArchiveListParams {
  // Mencari di kolom kode, nama_dokumen, nomor_dokumen, kategori.
  search?: string
  tipeRelasi?: ArchiveRelationType
  status?: ArchiveStatus
  page?: number
  pageSize?: number
  sortBy?: ArchiveSortField
  sortDir?: 'asc' | 'desc'
}

const KODE_PATTERN = /^ARS-[0-9]{4}-[0-9]{3}$/

function mapInputToRow(input: Partial<ArchiveInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (input.kode !== undefined) row.kode = input.kode.trim().toUpperCase()
  if (input.nama_dokumen !== undefined) row.nama_dokumen = input.nama_dokumen.trim()
  if (input.kategori !== undefined) row.kategori = input.kategori?.trim() || null
  if (input.jenis_dokumen !== undefined) row.jenis_dokumen = input.jenis_dokumen?.trim() || null
  if (input.nomor_dokumen !== undefined) row.nomor_dokumen = input.nomor_dokumen?.trim() || null
  if (input.tanggal_dokumen !== undefined) row.tanggal_dokumen = input.tanggal_dokumen || null
  if (input.tipe_relasi !== undefined) row.tipe_relasi = input.tipe_relasi
  if (input.location_id !== undefined) row.location_id = input.location_id
  if (input.parcel_id !== undefined) row.parcel_id = input.parcel_id
  if (input.project_id !== undefined) row.project_id = input.project_id
  if (input.gudang !== undefined) row.gudang = input.gudang?.trim() || null
  if (input.rak !== undefined) row.rak = input.rak?.trim() || null
  if (input.box !== undefined) row.box = input.box?.trim() || null
  if (input.folder !== undefined) row.folder = input.folder?.trim() || null
  if (input.status !== undefined) row.status = input.status
  if (input.catatan !== undefined) row.catatan = input.catatan?.trim() || null
  return row
}

// Validasi §12: kode ARS-YYYY-NNN, nama wajib, dan aturan relasi —
// tipe menentukan FK mana yang wajib dan mana yang harus kosong.
// Aturan yang sama ditegakkan CHECK archives_relation_valid di database.
function validateInput(input: Partial<ArchiveInput>): void {
  if (input.kode !== undefined) {
    const kode = input.kode.trim().toUpperCase()
    if (!kode) throw new ServiceError('Kode arsip wajib diisi.')
    if (!KODE_PATTERN.test(kode)) {
      throw new ServiceError('Format kode harus ARS-YYYY-NNN (contoh: ARS-2026-001).')
    }
  }
  if (input.nama_dokumen !== undefined && !input.nama_dokumen.trim()) {
    throw new ServiceError('Nama dokumen wajib diisi.')
  }
  if (input.tipe_relasi !== undefined) {
    const { tipe_relasi, location_id, parcel_id, project_id } = input
    const hasLocation = location_id !== undefined && location_id !== null
    const hasParcel = parcel_id !== undefined && parcel_id !== null
    const hasProject = project_id !== undefined && project_id !== null
    if (tipe_relasi === 'LOCATION' && !hasLocation) {
      throw new ServiceError('Arsip bertipe Lokasi wajib memilih lokasi.')
    }
    if (tipe_relasi === 'PARCEL' && !hasParcel) {
      throw new ServiceError('Arsip bertipe Bidang wajib memilih bidang tanah.')
    }
    if (tipe_relasi === 'PROJECT' && !hasProject) {
      throw new ServiceError('Arsip bertipe Project wajib memilih project.')
    }
    if (tipe_relasi === 'GENERAL' && (hasLocation || hasParcel || hasProject)) {
      throw new ServiceError('Arsip umum tidak boleh terkait lokasi, bidang, atau project.')
    }
    const invalidTarget =
      (tipe_relasi !== 'LOCATION' && hasLocation) ||
      (tipe_relasi !== 'PARCEL' && hasParcel) ||
      (tipe_relasi !== 'PROJECT' && hasProject)
    if (invalidTarget) {
      throw new ServiceError('Relasi tidak konsisten dengan tipe arsip yang dipilih.')
    }
  }
}

export const archiveService = {
  async list(params: ArchiveListParams = {}): Promise<Paginated<ArchiveRecord>> {
    requireSupabase()
    const page = Math.max(1, Math.floor(params.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)))
    const sortBy: ArchiveSortField = params.sortBy ?? 'created_at'
    const sortDir = params.sortDir ?? 'desc'

    let query = supabase.from('archives').select(COLUMNS, { count: 'exact' })

    const search = sanitizeSearchTerm(params.search ?? '')
    if (search) {
      const pattern = `%${search}%`
      query = query.or(
        `kode.ilike.${pattern},nama_dokumen.ilike.${pattern},nomor_dokumen.ilike.${pattern},kategori.ilike.${pattern}`,
      )
    }
    if (params.tipeRelasi) query = query.eq('tipe_relasi', params.tipeRelasi)
    if (params.status) query = query.eq('status', params.status)

    query = query.order(sortBy, { ascending: sortDir === 'asc' })

    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, count } = await unwrapQueryWithCount<ArchiveRow[]>(query)
    return { data: data.map(toArchive), total: count, page, pageSize }
  },

  async getById(id: string): Promise<ArchiveRecord> {
    requireSupabase()
    try {
      const row = await unwrapQuerySingle<ArchiveRow>(
        supabase.from('archives').select(COLUMNS).eq('id', id).single(),
      )
      return toArchive(row)
    } catch (error) {
      if (isServiceError(error) && error.code === 'PGRST116') {
        throw new ServiceError('Arsip tidak ditemukan.', {
          code: 'ARCHIVE_NOT_FOUND',
          cause: error,
        })
      }
      throw error
    }
  },

  async create(input: ArchiveInput): Promise<ArchiveRecord> {
    requireSupabase()
    validateInput(input)
    try {
      const row = toArchive(await unwrapQuerySingle<ArchiveRow>(
        supabase.from('archives').insert(mapInputToRow(input)).select(COLUMNS).single(),
      ))
      auditService.log('CREATE', 'ARCHIVE', row.id, row.kode)
      return row
    } catch (error) {
      if (isServiceError(error) && error.code === '23505') {
        throw new ServiceError('Kode arsip sudah digunakan.', {
          code: 'KODE_DUPLICATE',
          cause: error,
        })
      }
      throw error
    }
  },

  async update(id: string, input: Partial<ArchiveInput>): Promise<ArchiveRecord> {
    requireSupabase()
    const patch = mapInputToRow(input)
    if (Object.keys(patch).length === 0) {
      throw new ServiceError('Tidak ada perubahan yang disimpan.')
    }
    validateInput(input)
    try {
      const row = toArchive(await unwrapQuerySingle<ArchiveRow>(
        supabase.from('archives').update(patch).eq('id', id).select(COLUMNS).single(),
      ))
      auditService.log('UPDATE', 'ARCHIVE', row.id, row.kode)
      if (input.status !== undefined) auditService.log('STATUS_CHANGE', 'ARCHIVE', row.id, row.kode + ' -> ' + row.status)
      return row
    } catch (error) {
      if (isServiceError(error) && error.code === '23505') {
        throw new ServiceError('Kode arsip sudah digunakan.', {
          code: 'KODE_DUPLICATE',
          cause: error,
        })
      }
      throw error
    }
  },

  async remove(id: string): Promise<void> {
    requireSupabase()
    const { data, error } = await supabase.from('archives').delete().eq('id', id).select('id')
    if (error) throw toServiceError(error)
    if (!data || data.length === 0) {
      throw new ServiceError(
        'Arsip tidak ditemukan atau Anda tidak memiliki izin menghapusnya.',
        { code: 'DELETE_FORBIDDEN' },
      )
    }
    auditService.log('DELETE', 'ARCHIVE', id)
  },
}
