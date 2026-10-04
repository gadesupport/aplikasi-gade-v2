import { isServiceError, ServiceError, toServiceError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { requireSupabase, sanitizeSearchTerm, unwrapQuery, unwrapQuerySingle, unwrapQueryWithCount } from './query'
import type { Paginated } from '../types/pagination'
import type { SurveyInput, SurveyLocationRef, SurveyParcelRef, SurveyRecord } from '../types/survey'

const COLUMNS =
  'id, lokasi_id, bidang_id, tanggal_survey, surveyor, hasil_survey, catatan, latitude, longitude, created_at, updated_at, lokasi:locations(id, kode, nama), bidang:land_parcels(id, kode, nomor_bidang)'

// supabase-js mengetip embed many-to-one sebagai array meskipun runtime
// mengembalikan objek tunggal — dinormalisasi lewat toSurvey().
interface SurveyRow extends Omit<SurveyRecord, 'lokasi' | 'bidang'> {
  lokasi: SurveyLocationRef | SurveyLocationRef[] | null
  bidang: SurveyParcelRef | SurveyParcelRef[] | null
}

function toSurvey(row: SurveyRow): SurveyRecord {
  return {
    ...row,
    lokasi: Array.isArray(row.lokasi) ? (row.lokasi[0] ?? null) : row.lokasi,
    bidang: Array.isArray(row.bidang) ? (row.bidang[0] ?? null) : row.bidang,
  }
}

const HISTORY_LIMIT = 50

export interface SurveyListParams {
  // Mencari di kolom surveyor, hasil_survey.
  search?: string
  lokasiId?: string
  bidangId?: string
  page?: number
  pageSize?: number
}

function mapInputToRow(input: Partial<SurveyInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (input.lokasi_id !== undefined) row.lokasi_id = input.lokasi_id
  if (input.bidang_id !== undefined) row.bidang_id = input.bidang_id
  if (input.tanggal_survey !== undefined) row.tanggal_survey = input.tanggal_survey
  if (input.surveyor !== undefined) row.surveyor = input.surveyor.trim()
  if (input.hasil_survey !== undefined) row.hasil_survey = input.hasil_survey.trim()
  if (input.catatan !== undefined) row.catatan = input.catatan?.trim() || null
  if (input.latitude !== undefined) row.latitude = input.latitude
  if (input.longitude !== undefined) row.longitude = input.longitude
  return row
}

// Validasi §8: minimal satu target, field wajib, koordinat dalam rentang
// dan berpasangan (sama seperti CHECK constraint database).
function validateSurveyInput(input: Partial<SurveyInput>): void {
  if (input.lokasi_id !== undefined && input.bidang_id !== undefined) {
    if (!input.lokasi_id && !input.bidang_id) {
      throw new ServiceError('Survey harus terkait lokasi atau bidang — minimal satu.')
    }
  }
  if (input.tanggal_survey !== undefined && !input.tanggal_survey) {
    throw new ServiceError('Tanggal survey wajib diisi.')
  }
  if (input.surveyor !== undefined && !input.surveyor.trim()) {
    throw new ServiceError('Nama surveyor wajib diisi.')
  }
  if (input.hasil_survey !== undefined && !input.hasil_survey.trim()) {
    throw new ServiceError('Hasil survey wajib diisi.')
  }
  if (input.latitude !== undefined && input.latitude !== null) {
    if (input.latitude < -90 || input.latitude > 90) {
      throw new ServiceError('Latitude harus di antara -90 dan 90.')
    }
  }
  if (input.longitude !== undefined && input.longitude !== null) {
    if (input.longitude < -180 || input.longitude > 180) {
      throw new ServiceError('Longitude harus di antara -180 dan 180.')
    }
  }
  if (
    input.latitude !== undefined &&
    input.longitude !== undefined &&
    (input.latitude === null) !== (input.longitude === null)
  ) {
    throw new ServiceError('Latitude dan longitude harus diisi (atau dikosongkan) berpasangan.')
  }
}

export const surveyService = {
  async list(params: SurveyListParams = {}): Promise<Paginated<SurveyRecord>> {
    requireSupabase()
    const page = Math.max(1, Math.floor(params.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)))

    let query = supabase.from('surveys').select(COLUMNS, { count: 'exact' })

    const search = sanitizeSearchTerm(params.search ?? '')
    if (search) {
      const pattern = `%${search}%`
      query = query.or(`surveyor.ilike.${pattern},hasil_survey.ilike.${pattern}`)
    }
    if (params.lokasiId) query = query.eq('lokasi_id', params.lokasiId)
    if (params.bidangId) query = query.eq('bidang_id', params.bidangId)

    query = query.order('tanggal_survey', { ascending: false }).order('created_at', {
      ascending: false,
    })

    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, count } = await unwrapQueryWithCount<SurveyRow[]>(query)
    return { data: data.map(toSurvey), total: count, page, pageSize }
  },

  // Histori survey satu lokasi/bidang (terbaru dulu) — section detail.
  async listHistoryByLocation(locationId: string): Promise<SurveyRecord[]> {
    requireSupabase()
    const rows =
      (await unwrapQuery<SurveyRow[]>(
        supabase
          .from('surveys')
          .select(COLUMNS)
          .eq('lokasi_id', locationId)
          .order('tanggal_survey', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(HISTORY_LIMIT),
      )) ?? []
    return rows.map(toSurvey)
  },

  async listHistoryByParcel(parcelId: string): Promise<SurveyRecord[]> {
    requireSupabase()
    const rows =
      (await unwrapQuery<SurveyRow[]>(
        supabase
          .from('surveys')
          .select(COLUMNS)
          .eq('bidang_id', parcelId)
          .order('tanggal_survey', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(HISTORY_LIMIT),
      )) ?? []
    return rows.map(toSurvey)
  },

  async getById(id: string): Promise<SurveyRecord> {
    requireSupabase()
    try {
      const row = await unwrapQuerySingle<SurveyRow>(
        supabase.from('surveys').select(COLUMNS).eq('id', id).single(),
      )
      return toSurvey(row)
    } catch (error) {
      if (isServiceError(error) && error.code === 'PGRST116') {
        throw new ServiceError('Data survey tidak ditemukan.', {
          code: 'SURVEY_NOT_FOUND',
          cause: error,
        })
      }
      throw error
    }
  },

  async create(input: SurveyInput): Promise<SurveyRecord> {
    requireSupabase()
    validateSurveyInput(input)
    const row = await unwrapQuerySingle<SurveyRow>(
      supabase.from('surveys').insert(mapInputToRow(input)).select(COLUMNS).single(),
    )
    return toSurvey(row)
  },

  async update(id: string, input: Partial<SurveyInput>): Promise<SurveyRecord> {
    requireSupabase()
    const patch = mapInputToRow(input)
    if (Object.keys(patch).length === 0) {
      throw new ServiceError('Tidak ada perubahan yang disimpan.')
    }
    validateSurveyInput(input)
    const row = await unwrapQuerySingle<SurveyRow>(
      supabase.from('surveys').update(patch).eq('id', id).select(COLUMNS).single(),
    )
    return toSurvey(row)
  },

  async remove(id: string): Promise<void> {
    requireSupabase()
    const { data, error } = await supabase.from('surveys').delete().eq('id', id).select('id')
    if (error) throw toServiceError(error)
    if (!data || data.length === 0) {
      throw new ServiceError('Data survey tidak ditemukan.', { code: 'DELETE_FORBIDDEN' })
    }
  },
}
