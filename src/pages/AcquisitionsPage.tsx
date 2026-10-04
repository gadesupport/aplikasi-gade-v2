import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AcquisitionStatusBadge from '../components/AcquisitionStatusBadge'
import { useAcquisitions } from '../hooks/useAcquisitions'
import { formatDate, formatLuas, formatRupiah } from '../lib/format'
import { locationService } from '../services/locationService'
import type { LocationOption } from '../services/locationService'
import { ACQUISITION_STATUSES, ACQUISITION_STATUS_LABELS } from '../types/acquisition'
import type { AcquisitionStatus } from '../types/acquisition'

export default function AcquisitionsPage() {
  const [lokasiFilter, setLokasiFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<AcquisitionStatus | null>(null)
  const [page, setPage] = useState(1)
  const [lokasiOptions, setLokasiOptions] = useState<LocationOption[]>([])
  const { result, isLoading, error } = useAcquisitions({
    lokasiId: lokasiFilter || null,
    status: statusFilter,
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
        // Filter lokasi opsional — biarkan kosong bila gagal dimuat.
      })
    return () => {
      active = false
    }
  }, [])

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1
  const to = Math.min(result.total, result.page * result.pageSize)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pembebasan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Proses pembebasan bidang tanah — tambah/ubah dilakukan dari halaman detail bidang.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
          <select
            value={lokasiFilter}
            onChange={(event) => {
              setLokasiFilter(event.target.value)
              setPage(1)
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 sm:w-56"
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
            onChange={(event) => {
              setStatusFilter(event.target.value === '' ? null : (event.target.value as AcquisitionStatus))
              setPage(1)
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 sm:w-52"
          >
            <option value="">Semua status</option>
            {ACQUISITION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ACQUISITION_STATUS_LABELS[status]}
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
            Memuat data pembebasan…
          </div>
        ) : result.data.length === 0 ? (
          <div className="m-4 rounded-lg border border-dashed border-slate-300 p-10 text-center">
            <p className="text-sm font-medium text-slate-700">Belum ada data pembebasan.</p>
            <p className="mt-1 text-sm text-slate-500">
              Buka detail sebuah bidang tanah lalu tambahkan catatan pembebasan.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-medium">Bidang</th>
                    <th className="px-4 py-3 font-medium">Lokasi</th>
                    <th className="px-4 py-3 font-medium">Mulai</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Kesepakatan</th>
                    <th className="px-4 py-3 font-medium">Luas</th>
                    <th className="px-4 py-3 font-medium">Uang Muka</th>
                    <th className="px-4 py-3 font-medium">Pelunasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.data.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          to={`/bidang/${row.bidang_id}`}
                          className="font-mono text-xs text-emerald-600 hover:text-emerald-700"
                        >
                          {row.land_parcels?.kode ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {row.land_parcels?.lokasi
                          ? `${row.land_parcels.lokasi.kode} — ${row.land_parcels.lokasi.nama}`
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">
                        {formatDate(row.tanggal_mulai)}
                      </td>
                      <td className="px-4 py-3">
                        <AcquisitionStatusBadge status={row.status_transaksi} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {formatRupiah(row.harga_kesepakatan)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {formatLuas(row.luas_dibebaskan)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {formatRupiah(row.uang_muka)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {formatRupiah(row.pelunasan)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              <span>
                Menampilkan {from}–{to} dari {result.total} catatan
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
