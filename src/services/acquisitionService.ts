import { isServiceError, ServiceError, toServiceError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { requireSupabase, unwrapQuery, unwrapQuerySingle, unwrapQueryWithCount } from './query'
import { auditService } from './auditService'
import type { Paginated } from '../types/pagination'
import type {
  AcquisitionInput,
  AcquisitionRecap,
  AcquisitionStatus,
  AcquisitionWithParcel,
} from '../types/acquisition'

// Embed tanpa alias agar filter PostgREST `land_parcels.lokasi_id` bekerja.
const COLUMNS =
  'id, bidang_id, tanggal_mulai, harga_penawaran, harga_kesepakatan, luas_dibebaskan, uang_muka, pelunasan, tanggal_pelunasan, pihak_terlibat, catatan, status_transaksi, created_at, updated_at, land_parcels(id, kode, nomor_bidang, lokasi:locations(id, kode, nama))'

// supabase-js mengetip SEMUA embed (termasuk bersarang) sebagai array
// meskipun runtime mengembalikan objek tunggal — dinormalisasi bertingkat
// lewat toAcquisition().
interface LocationLike {
  id: string
  kode: string
  nama: string
}

interface AcquisitionParcelRaw {
  id: string
  kode: string
  nomor_bidang: string | null
  lokasi: LocationLike | LocationLike[] | null
}

interface AcquisitionRow extends Omit<AcquisitionWithParcel, 'land_parcels'> {
  land_parcels: AcquisitionParcelRaw | AcquisitionParcelRaw[] | null
}

function toAcquisition(row: AcquisitionRow): AcquisitionWithParcel {
  const raw = Array.isArray(row.land_parcels) ? (row.land_parcels[0] ?? null) : row.land_parcels
  const parcel = raw
    ? {
        ...raw,
        lokasi: Array.isArray(raw.lokasi) ? (raw.lokasi[0] ?? null) : raw.lokasi,
      }
    : null
  return { ...row, land_parcels: parcel }
}

export interface AcquisitionListParams {
  lokasiId?: string
  status?: AcquisitionStatus
  page?: number
  pageSize?: number
}

const BY_PARCEL_LIMIT = 100

function mapInputToRow(input: Partial<AcquisitionInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (input.bidang_id !== undefined) row.bidang_id = input.bidang_id
  if (input.tanggal_mulai !== undefined) row.tanggal_mulai = input.tanggal_mulai
  if (input.harga_penawaran !== undefined) row.harga_penawaran = input.harga_penawaran
  if (input.harga_kesepakatan !== undefined) row.harga_kesepakatan = input.harga_kesepakatan
  if (input.luas_dibebaskan !== undefined) row.luas_dibebaskan = input.luas_dibebaskan
  if (input.uang_muka !== undefined) row.uang_muka = input.uang_muka
  if (input.pelunasan !== undefined) row.pelunasan = input.pelunasan
  if (input.tanggal_pelunasan !== undefined) row.tanggal_pelunasan = input.tanggal_pelunasan || null
  if (input.pihak_terlibat !== undefined) row.pihak_terlibat = input.pihak_terlibat?.trim() || null
  if (input.catatan !== undefined) row.catatan = input.catatan?.trim() || null
  if (input.status_transaksi !== undefined) row.status_transaksi = input.status_transaksi
  return row
}

function validateInput(input: Partial<AcquisitionInput>): void {
  if (input.bidang_id !== undefined && !input.bidang_id) {
    throw new ServiceError('Bidang wajib dipilih.')
  }
  if (input.tanggal_mulai !== undefined && !input.tanggal_mulai) {
    throw new ServiceError('Tanggal mulai wajib diisi.')
  }
}

export const acquisitionService = {
  async list(params: AcquisitionListParams = {}): Promise<Paginated<AcquisitionWithParcel>> {
    requireSupabase()
    const page = Math.max(1, Math.floor(params.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)))

    let query = supabase.from('acquisitions').select(COLUMNS, { count: 'exact' })
    if (params.lokasiId) query = query.eq('land_parcels.lokasi_id', params.lokasiId)
    if (params.status) query = query.eq('status_transaksi', params.status)

    query = query
      .order('tanggal_mulai', { ascending: false })
      .order('created_at', { ascending: false })

    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, count } = await unwrapQueryWithCount<AcquisitionRow[]>(query)
    return { data: data.map(toAcquisition), total: count, page, pageSize }
  },

  // Daftar pembebasan satu bidang (halaman detail bidang).
  async listByParcel(parcelId: string): Promise<AcquisitionWithParcel[]> {
    requireSupabase()
    const rows =
      (await unwrapQuery<AcquisitionRow[]>(
        supabase
          .from('acquisitions')
          .select(COLUMNS)
          .eq('bidang_id', parcelId)
          .order('tanggal_mulai', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(BY_PARCEL_LIMIT),
      )) ?? []
    return rows.map(toAcquisition)
  },

  async getById(id: string): Promise<AcquisitionWithParcel> {
    requireSupabase()
    try {
      const row = await unwrapQuerySingle<AcquisitionRow>(
        supabase.from('acquisitions').select(COLUMNS).eq('id', id).single(),
      )
      return toAcquisition(row)
    } catch (error) {
      if (isServiceError(error) && error.code === 'PGRST116') {
        throw new ServiceError('Data pembebasan tidak ditemukan.', {
          code: 'ACQUISITION_NOT_FOUND',
          cause: error,
        })
      }
      throw error
    }
  },

  async create(input: AcquisitionInput): Promise<AcquisitionWithParcel> {
    requireSupabase()
    validateInput(input)
    const row = toAcquisition(await unwrapQuerySingle<AcquisitionRow>(
      supabase.from('acquisitions').insert(mapInputToRow(input)).select(COLUMNS).single(),
    ))
    auditService.log('CREATE', 'ACQUISITION', row.id, row.status_transaksi)
    return row
  },

  async update(id: string, input: Partial<AcquisitionInput>): Promise<AcquisitionWithParcel> {
    requireSupabase()
    const patch = mapInputToRow(input)
    if (Object.keys(patch).length === 0) {
      throw new ServiceError('Tidak ada perubahan yang disimpan.')
    }
    validateInput(input)
    const row = toAcquisition(await unwrapQuerySingle<AcquisitionRow>(
      supabase.from('acquisitions').update(patch).eq('id', id).select(COLUMNS).single(),
    ))
    auditService.log('UPDATE', 'ACQUISITION', row.id)
    if (input.status_transaksi !== undefined) auditService.log('STATUS_CHANGE', 'ACQUISITION', row.id, '-> ' + row.status_transaksi)
    return row
  },

  async remove(id: string): Promise<void> {
    requireSupabase()
    const { data, error } = await supabase
      .from('acquisitions')
      .delete()
      .eq('id', id)
      .select('id')
    if (error) throw toServiceError(error)
    if (!data || data.length === 0) {
      throw new ServiceError(
        'Data pembebasan tidak ditemukan atau Anda tidak memiliki izin menghapusnya.',
        { code: 'DELETE_FORBIDDEN' },
      )
    }
    auditService.log('DELETE', 'ACQUISITION', id)
  },

  // Rekap pembebasan satu lokasi (view acquisition_location_recap);
  // null bila lokasi belum memiliki data pembebasan sama sekali.
  async getRecapByLocation(locationId: string): Promise<AcquisitionRecap | null> {
    requireSupabase()
    return unwrapQuery<AcquisitionRecap | null>(
      supabase
        .from('acquisition_location_recap')
        .select('*')
        .eq('location_id', locationId)
        .maybeSingle(),
    )
  },
}
