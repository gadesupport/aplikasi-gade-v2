import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ParcelStatusBadge from '../components/ParcelStatusBadge'
import { useParcels } from '../hooks/useParcels'
import { formatLuas } from '../lib/format'
import { locationService } from '../services/locationService'
import type { LocationOption } from '../services/locationService'
import { PARCEL_STATUSES, PARCEL_STATUS_LABELS } from '../types/parcel'
import type { ParcelStatus } from '../types/parcel'

export default function ParcelsPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<ParcelStatus | null>(null)
  const [lokasiFilter, setLokasiFilter] = useState('')
  const [page, setPage] = useState(1)
  const [lokasiOptions, setLokasiOptions] = useState<LocationOption[]>([])
  const { result, isLoading, error } = useParcels({
    search: searchTerm,
    status: statusFilter,
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
      .catch(() => {
        // Filter lokasi bersifat opsional — biarkan kosong bila gagal dimuat.
      })
    return () => {
      active = false
    }
  }, [])

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1
  const to = Math.min(result.total, result.page * result.pageSize)
  const hasFilter = searchTerm.trim() !== '' || statusFilter !== null || lokasiFilter !== ''

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPage(1)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bidang Tanah</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola bidang tanah individual di dalam setiap lokasi.
          </p>
        </div>
        <Link
          to="/bidang/baru"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          + Tambah Bidang
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => resetPage(setSearchTerm)(event.target.value)}
            placeholder="Cari kode bidang, nomor bidang, atau nomor hak…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <select
            value={lokasiFilter}
            onChange={(event) => resetPage(setLokasiFilter)(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 lg:w-56"
          >
            <option value="">Semua lokasi</option>
            {lokasiOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.nama}
              </option>
            ))}
          </select>
          <select
            value={statusFilter ?? ''}
            onChange={(event) =>
              resetPage((value: string) => setStatusFilter(value === '' ? null : (value as ParcelStatus)))(event.target.value)
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 lg:w-52"
          >
            <option value="">Semua status</option>
            {PARCEL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PARCEL_STATUS_LABELS[status]}
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
            Memuat data bidang tanah…
          </div>
        ) : result.data.length === 0 ? (
          <div className="m-4 rounded-lg border border-dashed border-slate-300 p-10 text-center">
            <p className="text-sm font-medium text-slate-700">Belum ada bidang tanah.</p>
            <p className="mt-1 text-sm text-slate-500">
              {hasFilter
                ? 'Tidak ada hasil yang cocok dengan pencarian/filter.'
                : 'Mulai dengan menambahkan bidang pertama.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-medium">Kode</th>
                    <th className="px-4 py-3 font-medium">No. Bidang</th>
                    <th className="px-4 py-3 font-medium">Lokasi</th>
                    <th className="px-4 py-3 font-medium">Luas</th>
                    <th className="px-4 py-3 font-medium">Jenis Hak</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.data.map((parcel) => (
                    <tr
                      key={parcel.id}
                      onClick={() => navigate(`/bidang/${parcel.id}`)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{parcel.kode}</td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {parcel.nomor_bidang || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {parcel.lokasi ? `${parcel.lokasi.kode} — ${parcel.lokasi.nama}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatLuas(parcel.luas)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {parcel.jenis_hak || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <ParcelStatusBadge status={parcel.status_pembebasan} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/bidang/${parcel.id}`}
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
                Menampilkan {from}–{to} dari {result.total} bidang
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
