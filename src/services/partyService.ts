import { isServiceError, ServiceError, toServiceError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { requireSupabase, sanitizeSearchTerm, unwrapQuery, unwrapQuerySingle, unwrapQueryWithCount } from './query'
import { auditService } from './auditService'
import type { Paginated } from '../types/pagination'
import type {
  ParcelPartyInput,
  ParcelPartyWithParty,
  PartyInput,
  PartyRecord,
  PartyRef,
  PartyType,
} from '../types/party'

const PARTY_COLUMNS = 'id, nama, nik, alamat, nomor_telepon, tipe_pihak, catatan, created_at, updated_at'

const RELATION_COLUMNS =
  'id, parcel_id, party_id, peran, keterangan, created_at, updated_at, party:parties(id, nama, nik, nomor_telepon, tipe_pihak)'

const SORT_FIELDS = ['nama', 'created_at', 'updated_at'] as const
export type PartySortField = (typeof SORT_FIELDS)[number]

export interface PartyListParams {
  // Mencari di kolom nama, nik, nomor_telepon.
  search?: string
  tipe?: PartyType
  page?: number
  pageSize?: number
  sortBy?: PartySortField
  sortDir?: 'asc' | 'desc'
}

// supabase-js mengetip embed many-to-one sebagai array meskipun runtime
// mengembalikan objek tunggal — dinormalisasi lewat toRelation().
interface ParcelPartyRow extends Omit<ParcelPartyWithParty, 'party'> {
  party: PartyRef | PartyRef[] | null
}

function toRelation(row: ParcelPartyRow): ParcelPartyWithParty {
  return {
    ...row,
    party: Array.isArray(row.party) ? (row.party[0] ?? null) : row.party,
  }
}

function mapPartyInputToRow(input: Partial<PartyInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (input.nama !== undefined) row.nama = input.nama.trim()
  if (input.nik !== undefined) row.nik = input.nik?.trim() || null
  if (input.alamat !== undefined) row.alamat = input.alamat?.trim() || null
  if (input.nomor_telepon !== undefined) row.nomor_telepon = input.nomor_telepon?.trim() || null
  if (input.tipe_pihak !== undefined) row.tipe_pihak = input.tipe_pihak
  if (input.catatan !== undefined) row.catatan = input.catatan?.trim() || null
  return row
}

function validatePartyInput(input: Partial<PartyInput>): void {
  if (input.nama !== undefined && !input.nama.trim()) {
    throw new ServiceError('Nama pihak wajib diisi.')
  }
}

function rethrowDuplicateNik(error: unknown): never {
  if (isServiceError(error) && error.code === '23505') {
    throw new ServiceError('NIK sudah terdaftar untuk pihak lain.', { code: 'NIK_DUPLICATE', cause: error })
  }
  throw error
}

export const partyService = {
  async list(params: PartyListParams = {}): Promise<Paginated<PartyRecord>> {
    requireSupabase()
    const page = Math.max(1, Math.floor(params.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)))
    const sortBy: PartySortField = params.sortBy ?? 'nama'
    const sortDir = params.sortDir ?? 'asc'

    let query = supabase.from('parties').select(PARTY_COLUMNS, { count: 'exact' })

    const search = sanitizeSearchTerm(params.search ?? '')
    if (search) {
      const pattern = `%${search}%`
      query = query.or(`nama.ilike.${pattern},nik.ilike.${pattern},nomor_telepon.ilike.${pattern}`)
    }
    if (params.tipe) query = query.eq('tipe_pihak', params.tipe)

    query = query.order(sortBy, { ascending: sortDir === 'asc' })

    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, count } = await unwrapQueryWithCount<PartyRecord[]>(query)
    return { data, total: count, page, pageSize }
  },

  async getById(id: string): Promise<PartyRecord> {
    requireSupabase()
    try {
      return await unwrapQuerySingle<PartyRecord>(
        supabase.from('parties').select(PARTY_COLUMNS).eq('id', id).single(),
      )
    } catch (error) {
      if (isServiceError(error) && error.code === 'PGRST116') {
        throw new ServiceError('Pihak tidak ditemukan.', { code: 'PARTY_NOT_FOUND', cause: error })
      }
      throw error
    }
  },

  async create(input: PartyInput): Promise<PartyRecord> {
    requireSupabase()
    validatePartyInput(input)
    try {
      const row = await unwrapQuerySingle<PartyRecord>(
        supabase.from('parties').insert(mapPartyInputToRow(input)).select(PARTY_COLUMNS).single(),
      )
      auditService.log('CREATE', 'PARTY', row.id, row.nama)
      return row
    } catch (error) {
      rethrowDuplicateNik(error)
    }
  },

  async update(id: string, input: Partial<PartyInput>): Promise<PartyRecord> {
    requireSupabase()
    const patch = mapPartyInputToRow(input)
    if (Object.keys(patch).length === 0) {
      throw new ServiceError('Tidak ada perubahan yang disimpan.')
    }
    validatePartyInput(input)
    try {
      const row = await unwrapQuerySingle<PartyRecord>(
        supabase.from('parties').update(patch).eq('id', id).select(PARTY_COLUMNS).single(),
      )
      auditService.log('UPDATE', 'PARTY', row.id, row.nama)
      return row
    } catch (error) {
      rethrowDuplicateNik(error)
    }
  },

  async remove(id: string): Promise<void> {
    requireSupabase()
    // .select('id') agar bisa dibedakan: tidak ada baris terhapus berarti
    // pihak tidak ada, atau RLS (bukan ADMIN/SUPERADMIN) memblokir delete.
    const { data, error } = await supabase.from('parties').delete().eq('id', id).select('id')
    if (error) throw toServiceError(error)
    if (!data || data.length === 0) {
      throw new ServiceError('Pihak tidak ditemukan atau Anda tidak memiliki izin menghapusnya.', {
        code: 'DELETE_FORBIDDEN',
      })
    }
    auditService.log('DELETE', 'PARTY', id)
  },

  // Opsi pihak (ringkas) untuk dropdown penautan legalitas/pihak.
  async listOptions(): Promise<PartyRef[]> {
    requireSupabase()
    return (
      (await unwrapQuery<PartyRef[]>(
        supabase
          .from('parties')
          .select('id, nama, nik, nomor_telepon, tipe_pihak')
          .order('nama', { ascending: true })
          .limit(500),
      )) ?? []
    )
  },

  // ===== Relasi bidang ↔ pihak (parcel_parties) =====

  // Daftar pihak yang terhubung dengan satu bidang.
  async listByParcel(parcelId: string): Promise<ParcelPartyWithParty[]> {
    requireSupabase()
    const rows =
      (await unwrapQuery<ParcelPartyRow[]>(
        supabase
          .from('parcel_parties')
          .select(RELATION_COLUMNS)
          .eq('parcel_id', parcelId)
          .order('created_at', { ascending: true }),
      )) ?? []
    return rows.map(toRelation)
  },

  // Hubungkan pihak ke bidang (satu pihak maksimal sekali per bidang).
  async addPartyToParcel(input: ParcelPartyInput): Promise<ParcelPartyWithParty> {
    requireSupabase()
    const row: Record<string, unknown> = {
      parcel_id: input.parcel_id,
      party_id: input.party_id,
      peran: input.peran?.trim() || null,
      keterangan: input.keterangan?.trim() || null,
    }
    try {
      const created = await unwrapQuerySingle<ParcelPartyRow>(
        supabase.from('parcel_parties').insert(row).select(RELATION_COLUMNS).single(),
      )
      const relation = toRelation(created)
      auditService.log('CREATE', 'PARCEL_PARTY', relation.id, relation.peran ?? undefined)
      return relation
    } catch (error) {
      if (isServiceError(error) && error.code === '23505') {
        throw new ServiceError('Pihak ini sudah terhubung dengan bidang tersebut.', {
          code: 'RELATION_DUPLICATE',
          cause: error,
        })
      }
      throw error
    }
  },

  async updateParcelParty(
    id: string,
    input: Pick<ParcelPartyInput, 'peran' | 'keterangan'>,
  ): Promise<ParcelPartyWithParty> {
    requireSupabase()
    const patch: Record<string, unknown> = {
      peran: input.peran?.trim() || null,
      keterangan: input.keterangan?.trim() || null,
    }
    const row = toRelation(await unwrapQuerySingle<ParcelPartyRow>(
      supabase.from('parcel_parties').update(patch).eq('id', id).select(RELATION_COLUMNS).single(),
    ))
    auditService.log('UPDATE', 'PARCEL_PARTY', row.id)
    return row
  },

  // Hapus relasi pihak–bidang (data master pihak tetap ada).
  async removeParcelParty(id: string): Promise<void> {
    requireSupabase()
    auditService.log('DELETE', 'PARCEL_PARTY', id)
    const { data, error } = await supabase
      .from('parcel_parties')
      .delete()
      .eq('id', id)
      .select('id')
    if (error) throw toServiceError(error)
    if (!data || data.length === 0) {
      throw new ServiceError('Relasi pihak tidak ditemukan.', { code: 'RELATION_NOT_FOUND' })
    }
  },
}
