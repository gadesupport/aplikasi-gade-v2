import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import LegalityStatusBadge from '../components/LegalityStatusBadge'
import { useLegalityList } from '../hooks/useLegalities'
import { formatDate } from '../lib/format'
import { legalityService } from '../services/legalityService'
import { locationService } from '../services/locationService'
import type { LocationOption } from '../services/locationService'
import {
  LEGALITY_DOC_TYPES,
  LEGALITY_DOC_TYPE_LABELS,
  LEGALITY_STATUSES,
  LEGALITY_STATUS_LABELS,
} from '../types/legality'
import type { LegalityStatus } from '../types/legality'

export default function LegalitiesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<LegalityStatus | null>(null)
  const [jenisFilter, setJenisFilter] = useState<string>('')
  const [lokasiFilter, setLokasiFilter] = useState('')
  const [lokasiOptions, setLokasiOptions] = useState<LocationOption[]>([])
  const [page, setPage] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { result, isLoading, error } = useLegalityList({
    search: searchTerm,
    status: statusFilter,
    jenis: jenisFilter,
    lokasiId: lokasiFilter || null,
    page,
  })

  useEffect(() => {
    let active = true
    locationService
      .listOptions()
      .then((options) => {
        if (active) setLokasiOptions(options)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1
  const to = Math.min(result.total, result.page * result.pageSize)
  const hasFilter =
    searchTerm.trim() !== '' || statusFilter !== null || jenisFilter !== '' || lokasiFilter !== ''

  async function handleDelete(row: { id: string; jenis_dokumen: string }) {
    const confirmed = window.confirm(`Hapus data legalitas ${row.jenis_dokumen}?`)
    if (!confirmed) return
    setDeletingId(row.id)
    setDeleteError(null)
    try {
      await legalityService.remove(row.id)
      setPage(1)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Gagal menghapus legalitas.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Legalitas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Semua dokumen legalitas pada level bidang — checklist kelengkapan tersedia di halaman
            detail tiap bidang.
          </p>
        </div>
        <Link
          to="/legalitas/baru"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          + Tambah Legalitas
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
            placeholder="Cari nomor dokumen atau penerbit…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <select
            value={lokasiFilter}
            onChange={(event) => {
              setLokasiFilter(event.target.value)
              setPage(1)
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 lg:w-44"
          >
            <option value="">Semua lokasi</option>
            {lokasiOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.nama}
              </option>
            ))}
          </select>
          <select
            value={jenisFilter}
            onChange={(event) => {
              setJenisFilter(event.target.value)
              setPage(1)
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 lg:w-48"
          >
            <option value="">Semua jenis</option>
            {LEGALITY_DOC_TYPES.map((jenis) => (
              <option key={jenis} value={jenis}>
                {LEGALITY_DOC_TYPE_LABELS[jenis]}
              </option>
            ))}
          </select>
          <select
            value={statusFilter ?? ''}
            onChange={(event) => {
              setStatusFilter(event.target.value === '' ? null : (event.target.value as LegalityStatus))
              setPage(1)
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 lg:w-48"
          >
            <option value="">Semua status</option>
            {LEGALITY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {LEGALITY_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        {deleteError && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {deleteError}
          </div>
        )}

        {error ? (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-3 p-12 text-sm text-slate-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
            Memuat data legalitas…
          </div>
        ) : result.data.length === 0 ? (
          <div className="m-4 rounded-lg border border-dashed border-slate-300 p-10 text-center">
            <p className="text-sm font-medium text-slate-700">Belum ada data legalitas.</p>
            <p className="mt-1 text-sm text-slate-500">
              {hasFilter
                ? 'Tidak ada hasil yang cocok dengan pencarian/filter.'
                : 'Tambahkan legalitas, atau buka detail bidang untuk checklist per jenis dokumen.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-medium">Jenis</th>
                    <th className="px-4 py-3 font-medium">Nomor</th>
                    <th className="px-4 py-3 font-medium">Bidang</th>
                    <th className="px-4 py-3 font-medium">Lokasi</th>
                    <th className="px-4 py-3 font-medium">Tanggal</th>
                    <th className="px-4 py-3 font-medium">Pihak</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.data.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {LEGALITY_DOC_TYPE_LABELS[row.jenis_dokumen]}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {row.nomor_dokumen || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {row.bidang ? (
                          <Link
                            to={`/bidang/${row.bidang.id}`}
                            className="font-mono text-xs text-emerald-600 hover:text-emerald-700"
                          >
                            {row.bidang.kode}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {row.bidang?.lokasi
                          ? `${row.bidang.lokasi.kode} — ${row.bidang.lokasi.nama}`
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {formatDate(row.tanggal_dokumen)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{row.pihak?.nama || '—'}</td>
                      <td className="px-4 py-3">
                        <LegalityStatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            to={`/legalitas/${row.id}/edit`}
                            className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                          >
                            Ubah
                          </Link>
                          <button
                            type="button"
                            onClick={() => void handleDelete(row)}
                            disabled={deletingId === row.id}
                            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingId === row.id ? 'Menghapus…' : 'Hapus'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              <span>
                Menampilkan {from}–{to} dari {result.total} legalitas
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
