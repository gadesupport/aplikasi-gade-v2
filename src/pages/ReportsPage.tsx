import { useEffect, useMemo, useState } from 'react'
import Badge from '../components/Badge'
import { downloadCsv } from '../lib/csv'
import { locationService } from '../services/locationService'
import type { LocationOption } from '../services/locationService'
import { reportService } from '../services/reportService'
import type { ReportColumn, ReportKey } from '../services/reportService'
import { PARCEL_STATUSES, PARCEL_STATUS_LABELS } from '../types/parcel'

const REPORTS: { key: ReportKey; label: string }[] = [
  { key: 'LOKASI', label: 'Lokasi' },
  { key: 'BIDANG', label: 'Bidang' },
  { key: 'PIHAK', label: 'Pihak' },
  { key: 'LEGALITAS', label: 'Legalitas' },
  { key: 'PEMBEBASAN', label: 'Pembebasan' },
  { key: 'ARSIP', label: 'Arsip' },
  { key: 'GIS', label: 'GIS' },
]

// Filter per laporan: [lokasiId, status] — null berarti filter tak tersedia.
const REPORT_FILTERS: Record<ReportKey, { lokasi: boolean; statusOptions: string[] | null; statusLabel: string }> = {
  LOKASI: { lokasi: true, statusOptions: ['SURVEY', 'PEMBAHASAN', 'PROSES_PEMBEBASAN', 'SELESAI', 'DITOLAK', 'DITUNDA'], statusLabel: 'Status Lokasi' },
  BIDANG: { lokasi: true, statusOptions: [...PARCEL_STATUSES], statusLabel: 'Status Bidang' },
  PIHAK: { lokasi: false, statusOptions: ['PEMEGANG_HAK', 'AHLI_WARIS', 'KUASA', 'PENGUASA', 'PIHAK_LAIN'], statusLabel: 'Tipe Pihak' },
  LEGALITAS: { lokasi: true, statusOptions: ['ADA', 'BELUM_ADA', 'PROSES', 'TIDAK_RELEVAN', 'PERLU_VERIFIKASI'], statusLabel: 'Status Legalitas' },
  PEMBEBASAN: { lokasi: true, statusOptions: ['NEGOSIASI', 'SIAP_TRANSAKSI', 'TRANSAKSI', 'SELESAI', 'BATAL'], statusLabel: 'Status Transaksi' },
  ARSIP: { lokasi: true, statusOptions: ['TERSEDIA', 'DIPINJAM', 'HILANG', 'RUSAK', 'DIARSIPKAN'], statusLabel: 'Status Arsip' },
  GIS: { lokasi: false, statusOptions: null, statusLabel: 'Status' },
}

const STATUS_LABEL_OVERRIDES: Record<string, string> = {
  ...PARCEL_STATUS_LABELS,
}

export default function ReportsPage() {
  const [reportKey, setReportKey] = useState<ReportKey>('LOKASI')
  const [lokasiOptions, setLokasiOptions] = useState<LocationOption[]>([])
  const [lokasiId, setLokasiId] = useState('')
  const [status, setStatus] = useState('')
  const [columns, setColumns] = useState<ReportColumn[]>([])
  const [rows, setRows] = useState<Record<string, string | number | null>[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const filters = useMemo(
    () => ({ lokasiId: lokasiId || undefined, status: status || undefined }),
    [lokasiId, status],
  )

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError(null)
    reportService
      .fetchReport(reportKey, filters)
      .then((data) => {
        if (active) {
          setColumns(data.columns)
          setRows(data.rows)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat laporan.')
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [reportKey, filters])

  const reportFilters = REPORT_FILTERS[reportKey]
  const canDownload = rows.length > 0

  function handleDownloadCsv() {
    downloadCsv(`laporan-${reportKey.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`, columns, rows)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Laporan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Laporan tabular per modul dengan filter dan export CSV (AGENTS.md modul Laporan).
        </p>
      </div>

      {/* Pilih laporan */}
      <div className="flex flex-wrap gap-2">
        {REPORTS.map((report) => (
          <button
            key={report.key}
            type="button"
            onClick={() => {
              setReportKey(report.key)
              setStatus('')
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              reportKey === report.key
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {report.label}
          </button>
        ))}
      </div>

      {/* Filter */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          {reportFilters.lokasi && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Lokasi</label>
              <select
                value={lokasiId}
                onChange={(event) => setLokasiId(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Semua lokasi</option>
                {lokasiOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.nama}
                  </option>
                ))}
              </select>
            </div>
          )}
          {reportFilters.statusOptions && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                {reportFilters.statusLabel}
              </label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Semua</option>
                {reportFilters.statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {STATUS_LABEL_OVERRIDES[option] ?? option}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Badge tone="slate">{rows.length} baris</Badge>
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={!canDownload}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Unduh CSV
            </button>
          </div>
        </div>
      </div>

      {/* Tabel */}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-3 p-12 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
          Memuat laporan…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">Tidak ada data untuk laporan ini.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                {columns.map((column) => (
                  <th key={column.key} className="whitespace-nowrap px-4 py-3 font-medium">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.slice(0, 100).map((row, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  {columns.map((column) => (
                    <td key={column.key} className="whitespace-nowrap px-4 py-2.5 text-slate-700">
                      {row[column.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 100 && (
            <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
              Menampilkan 100 dari {rows.length} baris — unduh CSV untuk data lengkap.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
