import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArchiveRelationBadge, ArchiveStatusBadge } from '../components/ArchiveBadges'
import { useArchives } from '../hooks/useArchives'
import { formatDate } from '../lib/format'
import { ARCHIVE_RELATION_TYPES, ARCHIVE_RELATION_LABELS, ARCHIVE_STATUSES, ARCHIVE_STATUS_LABELS } from '../types/archive'
import type { ArchiveRelationType, ArchiveStatus } from '../types/archive'

export default function ArchivesPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [relasiFilter, setRelasiFilter] = useState<ArchiveRelationType | null>(null)
  const [statusFilter, setStatusFilter] = useState<ArchiveStatus | null>(null)
  const [page, setPage] = useState(1)
  const { result, isLoading, error } = useArchives({
    search: searchTerm,
    tipeRelasi: relasiFilter,
    status: statusFilter,
    page,
  })

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1
  const to = Math.min(result.total, result.page * result.pageSize)
  const hasFilter = searchTerm.trim() !== '' || relasiFilter !== null || statusFilter !== null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Arsip</h1>
          <p className="mt-1 text-sm text-slate-500">
            Arsip fisik — terkait lokasi, bidang, project, atau umum.
          </p>
        </div>
        <Link
          to="/arsip/baru"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          + Tambah Arsip
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value)
              setPage(1)
            }}
            placeholder="Cari kode, nama dokumen, nomor dokumen, atau kategori…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <select
            value={relasiFilter ?? ''}
            onChange={(event) => {
              setRelasiFilter(event.target.value === '' ? null : (event.target.value as ArchiveRelationType))
              setPage(1)
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 lg:w-44"
          >
            <option value="">Semua tipe relasi</option>
            {ARCHIVE_RELATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {ARCHIVE_RELATION_LABELS[type]}
              </option>
            ))}
          </select>
          <select
            value={statusFilter ?? ''}
            onChange={(event) => {
              setStatusFilter(event.target.value === '' ? null : (event.target.value as ArchiveStatus))
              setPage(1)
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 lg:w-44"
          >
            <option value="">Semua status</option>
            {ARCHIVE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ARCHIVE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-3 p-12 text-sm text-slate-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
            Memuat data arsip…
          </div>
        ) : result.data.length === 0 ? (
          <div className="m-4 rounded-lg border border-dashed border-slate-300 p-10 text-center">
            <p className="text-sm font-medium text-slate-700">Belum ada arsip.</p>
            <p className="mt-1 text-sm text-slate-500">
              {hasFilter
                ? 'Tidak ada hasil yang cocok dengan pencarian/filter.'
                : 'Mulai dengan menambahkan arsip pertama.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-medium">Kode</th>
                    <th className="px-4 py-3 font-medium">Nama Dokumen</th>
                    <th className="px-4 py-3 font-medium">Relasi</th>
                    <th className="px-4 py-3 font-medium">Tanggal</th>
                    <th className="px-4 py-3 font-medium">Lokasi Fisik</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.data.map((archive) => (
                    <tr
                      key={archive.id}
                      onClick={() => navigate(`/arsip/${archive.id}`)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{archive.kode}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {archive.nama_dokumen}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <ArchiveRelationBadge type={archive.tipe_relasi} />
                          {archive.locations && (
                            <span className="text-xs text-slate-500">
                              {archive.locations.kode} — {archive.locations.nama}
                            </span>
                          )}
                          {archive.land_parcels && (
                            <span className="text-xs text-slate-500">{archive.land_parcels.kode}</span>
                          )}
                          {archive.projects && (
                            <span className="text-xs text-slate-500">{archive.projects.kode}</span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {formatDate(archive.tanggal_dokumen)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {[archive.gudang, archive.rak, archive.box, archive.folder]
                          .filter(Boolean)
                          .join(' / ') || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <ArchiveStatusBadge status={archive.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/arsip/${archive.id}`}
                          className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                        >
                          Detail
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              <span>
                Menampilkan {from}–{to} dari {result.total} arsip
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={result.page <= 1}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sebelumnya
                </button>
                <span className="text-xs text-slate-500">
                  Halaman {result.page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={result.page >= totalPages}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
