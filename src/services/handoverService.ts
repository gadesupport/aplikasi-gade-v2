import { ServiceError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { requireSupabase, sanitizeSearchTerm, unwrapQuery, unwrapQueryWithCount } from './query'
import { auditService } from './auditService'
import type { Paginated } from '../types/pagination'
import type {
  HandoverArchiveRef,
  HandoverLocationRef,
  HandoverParcelRef,
  HandoverProjectRef,
  HandoverRecord,
  HandoverType,
} from '../types/handover'

const COLUMNS =
  'id, nomor, archive_id, tanggal, jenis, dari, kepada, keperluan, catatan, created_by, created_at, archives(id, kode, nama_dokumen, gudang, rak, box, folder, status, locations(id, kode, nama), land_parcels(id, kode, nomor_bidang), projects(id, kode, nama))'

// supabase-js mengetip SEMUA embed (termasuk bersarang) sebagai array —
// dinormalisasi bertingkat lewat toHandover().
function pick<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

interface HandoverArchiveRow extends Omit<HandoverArchiveRef, 'locations' | 'land_parcels' | 'projects'> {
  locations: HandoverLocationRef | HandoverLocationRef[] | null
  land_parcels: HandoverParcelRef | HandoverParcelRef[] | null
  projects: HandoverProjectRef | HandoverProjectRef[] | null
}

interface HandoverRow extends Omit<HandoverRecord, 'archives'> {
  archives: HandoverArchiveRow | HandoverArchiveRow[] | null
}

function toHandover(row: HandoverRow): HandoverRecord {
  const raw = pick(row.archives)
  const archive = raw
    ? {
        ...raw,
        locations: pick(raw.locations),
        land_parcels: pick(raw.land_parcels),
        projects: pick(raw.projects),
      }
    : null
  return { ...row, archives: archive }
}

export interface HandoverListParams {
  // Mencari di kolom nomor, dari, kepada.
  search?: string
  jenis?: HandoverType
  page?: number
  pageSize?: number
}

const BY_ARCHIVE_LIMIT = 100

function validateInput(input: {
  archiveId: string
  jenis: HandoverType
  tanggal: string
  dari: string
  kepada: string
}): void {
  if (!input.archiveId) {
    throw new ServiceError('Arsip wajib dipilih.')
  }
  if (!input.jenis) {
    throw new ServiceError('Jenis serah terima wajib dipilih.')
  }
  if (!input.tanggal) {
    throw new ServiceError('Tanggal wajib diisi.')
  }
  if (!input.dari.trim() || !input.kepada.trim()) {
    throw new ServiceError('Kolom Dari dan Kepada wajib diisi.')
  }
}

export const handoverService = {
  async list(params: HandoverListParams = {}): Promise<Paginated<HandoverRecord>> {
    requireSupabase()
    const page = Math.max(1, Math.floor(params.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)))

    let query = supabase.from('handovers').select(COLUMNS, { count: 'exact' })

    const search = sanitizeSearchTerm(params.search ?? '')
    if (search) {
      const pattern = `%${search}%`
      query = query.or(`nomor.ilike.${pattern},dari.ilike.${pattern},kepada.ilike.${pattern}`)
    }
    if (params.jenis) query = query.eq('jenis', params.jenis)

    query = query.order('created_at', { ascending: false })

    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, count } = await unwrapQueryWithCount<HandoverRow[]>(query)
    return { data: data.map(toHandover), total: count, page, pageSize }
  },

  // Histori serah terima satu arsip (terbaru dulu).
  async listByArchive(archiveId: string): Promise<HandoverRecord[]> {
    requireSupabase()
    const rows =
      (await unwrapQuery<HandoverRow[]>(
        supabase
          .from('handovers')
          .select(COLUMNS)
          .eq('archive_id', archiveId)
          .order('created_at', { ascending: false })
          .limit(BY_ARCHIVE_LIMIT),
      )) ?? []
    return rows.map(toHandover)
  },

  // Catat serah terima via RPC create_handover (atomik): insert histori +
  // update status arsip (KELUAR → DIPINJAM, KEMBALI → TERSEDIA). Nomor
  // dibuat server-side.
  async create(input: {
    archiveId: string
    jenis: HandoverType
    tanggal: string
    dari: string
    kepada: string
    keperluan: string | null
    catatan: string | null
  }): Promise<HandoverRecord> {
    requireSupabase()
    validateInput(input)
    const row = await unwrapQuery<HandoverRow>(
      supabase.rpc('create_handover', {
        p_archive_id: input.archiveId,
        p_jenis: input.jenis,
        p_tanggal: input.tanggal,
        p_dari: input.dari.trim(),
        p_kepada: input.kepada.trim(),
        p_keperluan: input.keperluan?.trim() ?? null,
        p_catatan: input.catatan?.trim() ?? null,
      }),
    )
    if (!row) {
      throw new ServiceError('Gagal mencatat serah terima.')
    }
    const record = toHandover(row as HandoverRow)
    auditService.log('HANDOVER', 'ARCHIVE', record.archive_id, record.nomor + ' (' + record.jenis + ')')
    return record
  },
}
