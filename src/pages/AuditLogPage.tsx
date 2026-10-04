import { useEffect, useState } from 'react'
import Badge from '../components/Badge'
import { useAuth } from '../hooks/useAuth'
import { auditService } from '../services/auditService'
import type { AuditAction, AuditLogRecord } from '../services/auditService'
import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS } from '../services/auditService'
import { formatDateTime } from '../lib/format'

// Halaman Audit Log (§16) — hanya SUPERADMIN (RLS menegakkan di database;
// UI memberi pesan jelas untuk role lain).

export default function AuditLogPage() {
  const { user } = useAuth()
  const isSuperadmin = user?.role === 'SUPERADMIN'

  const [actionFilter, setActionFilter] = useState<AuditAction | ''>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [logs, setLogs] = useState<AuditLogRecord[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSuperadmin) return
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm, isSuperadmin])

  useEffect(() => {
    if (!isSuperadmin) return
    let active = true
    setIsLoading(true)
    setError(null)
    auditService
      .list({
        action: actionFilter || undefined,
        search: debouncedSearch,
        page,
        pageSize: 25,
      })
      .then((result) => {
        if (active) {
          setLogs(result.data)
          setTotal(result.total)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat audit log.')
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [isSuperadmin, actionFilter, debouncedSearch, page])

  if (!isSuperadmin) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Halaman Audit Log hanya dapat diakses oleh SUPERADMIN.
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(total / 25))
  const from = total === 0 ? 0 : (page - 1) * 25 + 1
  const to = Math.min(total, page * 25)

  function actionTone(action: AuditAction): 'emerald' | 'amber' | 'orange' | 'red' | 'sky' | 'violet' | 'slate' | 'teal' | 'indigo' {
    switch (action) {
      case 'LOGIN':
      case 'DOWNLOAD':
        return 'sky'
      case 'CREATE':
      case 'UPLOAD':
        return 'emerald'
      case 'UPDATE':
      case 'STATUS_CHANGE':
      case 'HANDOVER':
        return 'amber'
      case 'DELETE':
        return 'red'
      case 'GIS_IMPORT':
      case 'GEOMETRY_CHANGE':
        return 'violet'
      case 'GIS_EXPORT':
        return 'teal'
      default:
        return 'slate'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
        <p className="mt-1 text-sm text-slate-500">
          Jejak aktivitas pengguna (§16) — log bersifat permanen dan hanya dapat dilihat
          SUPERADMIN.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value)
            setPage(1)
          }}
          placeholder="Cari entity atau deskripsi…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        <select
          value={actionFilter}
          onChange={(event) => {
            setActionFilter(event.target.value as AuditAction | '')
            setPage(1)
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 sm:w-52"
        >
          <option value="">Semua aksi</option>
          {AUDIT_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {AUDIT_ACTION_LABELS[action]}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-3 p-12 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
          Memuat audit log…
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">Belum ada aktivitas tercatat.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Waktu</th>
                <th className="px-4 py-3 font-medium">Pengguna</th>
                <th className="px-4 py-3 font-medium">Aksi</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Deskripsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">
                    {log.user?.nama ?? log.user_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={actionTone(log.action)}>{AUDIT_ACTION_LABELS[log.action]}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {log.entity}
                    {log.entity_id ? (
                      <span className="ml-1 font-mono text-xs text-slate-400">
                        {log.entity_id.slice(0, 8)}
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-slate-600" title={log.description ?? ''}>
                    {log.description || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
            <span>
              Menampilkan {from}–{to} dari {total} log
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sebelumnya
              </button>
              <span className="text-xs text-slate-500">
                Halaman {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
