import { useState } from 'react'
import { Link } from 'react-router-dom'
import HandoverTypeBadge from '../components/HandoverTypeBadge'
import { useHandovers } from '../hooks/useHandovers'
import { formatDate, formatDateTime } from '../lib/format'
import { downloadHandoverReceiptPdf, printHandoverReceiptPdf } from '../lib/handoverReceipt'
import { HANDOVER_TYPES, HANDOVER_TYPE_LABELS } from '../types/handover'
import type { HandoverRecord, HandoverType } from '../types/handover'

export default function HandoversPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [jenisFilter, setJenisFilter] = useState<HandoverType | null>(null)
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const { result, isLoading, error } = useHandovers({
    search: searchTerm,
    jenis: jenisFilter ?? undefined,
    page,
  })

  async function handleDownloadReceipt(row: HandoverRecord) {
    setBusyId(row.id)
    setActionError(null)
    try {
      await downloadHandoverReceiptPdf(row)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal membuat PDF.')
    } finally {
      setBusyId(null)
    }
  }

  async function handlePrintReceipt(row: HandoverRecord) {
    setBusyId(row.id)
    setActionError(null)
    try {
      await printHandoverReceiptPdf(row)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal mencetak.')
    } finally {
      setBusyId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1
  const to = Math.min(result.total, result.page * result.pageSize)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Serah Terima</h1>
        <p className="mt-1 text-sm text-slate-500">
          Histori permanen berkas masuk, keluar, dan kembali. Pencatatan dilakukan dari halaman
          detail arsip.
        </p>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value)
              setPage(1)
            }}
            placeholder="Cari nomor, dari, atau kepada…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <select
            value={jenisFilter ?? ''}
            onChange={(event) => {
              setJenisFilter(event.target.value === '' ? null : (event.target.value as HandoverType))
              setPage(1)
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 sm:w-52"
          >
            <option value="">Semua jenis</option>
            {HANDOVER_TYPES.map((type) => (
              <option key={type} value={type}>
                {HANDOVER_TYPE_LABELS[type]}
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
            Memuat histori serah terima…
          </div>
        ) : result.data.length === 0 ? (
          <div className="m-4 rounded-lg border border-dashed border-slate-300 p-10 text-center">
            <p className="text-sm font-medium text-slate-700">Belum ada histori serah terima.</p>
            <p className="mt-1 text-sm text-slate-500">
              Buka detail sebuah arsip lalu catat berkas masuk/keluar/kembali.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-medium">Nomor</th>
                    <th className="px-4 py-3 font-medium">Jenis</th>
                    <th className="px-4 py-3 font-medium">Arsip</th>
                    <th className="px-4 py-3 font-medium">Tanggal</th>
                    <th className="px-4 py-3 font-medium">Dari → Kepada</th>
                    <th className="px-4 py-3 font-medium">Keperluan</th>
                    <th className="px-4 py-3 font-medium">Dicatat</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.data.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700">
                        {row.nomor}
                      </td>
                      <td className="px-4 py-3">
                        <HandoverTypeBadge type={row.jenis} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/arsip/${row.archive_id}`}
                          className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                        >
                          {row.archives?.kode ?? '—'}
                        </Link>
                        {row.archives && (
                          <p className="max-w-xs truncate text-xs text-slate-500">
                            {row.archives.nama_dokumen}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">
                        {formatDate(row.tanggal)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {row.dari} → {row.kepada}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-sm text-slate-600">
                        {row.keperluan || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {formatDateTime(row.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void handleDownloadReceipt(row)}
                          disabled={busyId === row.id}
                          className="text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyId === row.id ? 'Memproses…' : 'PDF'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handlePrintReceipt(row)}
                          disabled={busyId === row.id}
                          className="ml-3 text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cetak
                        </button>
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

      <p className="text-xs text-slate-400">
        Catatan serah terima bersifat permanen — tidak dapat diedit atau dihapus dari aplikasi.
      </p>
    </div>
  )
}
