import { supabase } from '../lib/supabase'
import { requireSupabase, unwrapQuery, unwrapQueryWithCount, sanitizeSearchTerm } from './query'

// Audit log (§16) — pencatatan & pembacaan.
// log() bersifat fire-and-forget: kegagalan audit TIDAK menggagalkan
// operasi utama (hanya console.warn).

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'HANDOVER'
  | 'STATUS_CHANGE'
  | 'GIS_IMPORT'
  | 'GIS_EXPORT'
  | 'GEOMETRY_CHANGE'

export const AUDIT_ACTIONS: AuditAction[] = [
  'LOGIN',
  'LOGOUT',
  'CREATE',
  'UPDATE',
  'DELETE',
  'UPLOAD',
  'DOWNLOAD',
  'HANDOVER',
  'STATUS_CHANGE',
  'GIS_IMPORT',
  'GIS_EXPORT',
  'GEOMETRY_CHANGE',
]

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  CREATE: 'Create',
  UPDATE: 'Update',
  DELETE: 'Delete',
  UPLOAD: 'Upload',
  DOWNLOAD: 'Download',
  HANDOVER: 'Serah Terima',
  STATUS_CHANGE: 'Perubahan Status',
  GIS_IMPORT: 'Import GIS',
  GIS_EXPORT: 'Export GIS',
  GEOMETRY_CHANGE: 'Perubahan Geometry',
}

export interface AuditLogRecord {
  id: string
  user_id: string
  action: AuditAction
  entity: string
  entity_id: string | null
  description: string | null
  created_at: string
  user: { nama: string; role: string } | null
}

export const auditService = {
  // Tulis satu entri audit. Tidak perlu await (internal menangkap error).
  log(action: AuditAction, entity: string, entityId?: string, description?: string): void {
    void (async () => {
      try {
        requireSupabase()
        const { error } = await supabase.from('audit_logs').insert({
          action,
          entity,
          entity_id: entityId ?? null,
          description: description ?? null,
        })
        if (error) throw error
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.warn(`[GadeSystem] Audit log gagal (${action}/${entity}): ${message}`)
      }
    })()
  },

  // Pembacaan — RLS hanya mengizinkan SUPERADMIN.
  // Catatan: audit_logs.user_id menunjuk auth.users (bukan profiles), jadi
  // embed profiles tidak tersedia — nama/role di-resolve lewat query
  // profiles terpisah dan digabung di sini.
  async list(params: {
    action?: AuditAction
    search?: string
    page?: number
    pageSize?: number
  }): Promise<{ data: AuditLogRecord[]; total: number; page: number; pageSize: number }> {
    requireSupabase()
    const page = Math.max(1, Math.floor(params.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 25)))

    let query = supabase
      .from('audit_logs')
      .select('id, user_id, action, entity, entity_id, description, created_at', {
        count: 'exact',
      })
    if (params.action) query = query.eq('action', params.action)
    const search = sanitizeSearchTerm(params.search ?? '')
    if (search) {
      const pattern = `%${search}%`
      query = query.or(`entity.ilike.${pattern},description.ilike.${pattern}`)
    }
    query = query.order('created_at', { ascending: false })

    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, count } = await unwrapQueryWithCount<
      Omit<AuditLogRecord, 'user'>[]
    >(query)
    const logs = data ?? []

    // Resolve nama & role penulis dari profiles (RLS select authenticated).
    const userIds = [...new Set(logs.map((row) => row.user_id))]
    const profilesById = new Map<string, { nama: string; role: string }>()
    if (userIds.length > 0) {
      const profiles =
        (await unwrapQuery<{ id: string; nama: string; role: string }[]>(
          supabase.from('profiles').select('id, nama, role').in('id', userIds).limit(500),
        )) ?? []
      profiles.forEach((profile) => profilesById.set(profile.id, profile))
    }

    const normalized = logs.map<AuditLogRecord>((row) => ({
      ...row,
      user: profilesById.get(row.user_id) ?? null,
    }))
    return { data: normalized, total: count, page, pageSize }
  },

  // Cek apakah user saat ini boleh membaca audit (SUPERADMIN) — query
  // sukses berarti policy lolos, terlepas dari ada/tidaknya baris.
  async canRead(): Promise<boolean> {
    try {
      requireSupabase()
      const { error } = await supabase.from('audit_logs').select('id').limit(1)
      return !error
    } catch {
      return false
    }
  },
}
