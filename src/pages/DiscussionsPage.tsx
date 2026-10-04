import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DecisionBadge from '../components/DecisionBadge'
import { useDiscussions } from '../hooks/useDiscussions'
import { formatDate } from '../lib/format'
import { discussionService } from '../services/discussionService'
import { DISCUSSION_DECISIONS, DISCUSSION_DECISION_LABELS } from '../types/discussion'
import type { DiscussionDecision, DiscussionRecord } from '../types/discussion'

export default function DiscussionsPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [keputusanFilter, setKeputusanFilter] = useState<DiscussionDecision | null>(null)
  const [page, setPage] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { result, isLoading, error } = useDiscussions({
    search: searchTerm,
    keputusan: keputusanFilter,
    page,
  })

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1
  const to = Math.min(result.total, result.page * result.pageSize)
  const hasFilter = searchTerm.trim() !== '' || keputusanFilter !== null

  async function handleDelete(discussion: DiscussionRecord) {
    const confirmed = window.confirm(
      `Hapus pembahasan ${formatDate(discussion.tanggal)} (${DISCUSSION_DECISION_LABELS[discussion.keputusan]})?`,
    )
    if (!confirmed) return
    setDeletingId(discussion.id)
    setDeleteError(null)
    try {
      await discussionService.remove(discussion.id)
      setPage(1)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Gagal menghapus pembahasan.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pembahasan</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pembahasan lokasi/bidang dan keputusannya — TIDAK_LAYAK → DITOLAK, PERLU_KAJIAN →
            DITUNDA.
          </p>
        </div>
        <Link
          to="/pembahasan/baru"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          + Tambah Pembahasan
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value)
              setPage(1)
            }}
            placeholder="Cari peserta atau hasil pembahasan…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <select
            value={keputusanFilter ?? ''}
            onChange={(event) => {
              setKeputusanFilter(
                event.target.value === '' ? null : (event.target.value as DiscussionDecision),
              )
              setPage(1)
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 sm:w-52"
          >
            <option value="">Semua keputusan</option>
            {DISCUSSION_DECISIONS.map((decision) => (
              <option key={decision} value={decision}>
                {DISCUSSION_DECISION_LABELS[decision]}
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
            Memuat data pembahasan…
          </div>
        ) : result.data.length === 0 ? (
          <div className="m-4 rounded-lg border border-dashed border-slate-300 p-10 text-center">
            <p className="text-sm font-medium text-slate-700">Belum ada pembahasan.</p>
            <p className="mt-1 text-sm text-slate-500">
              {hasFilter
                ? 'Tidak ada hasil yang cocok dengan pencarian/filter.'
                : 'Mulai dengan mencatat pembahasan pertama.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-medium">Tanggal</th>
                    <th className="px-4 py-3 font-medium">Target</th>
                    <th className="px-4 py-3 font-medium">Peserta</th>
                    <th className="px-4 py-3 font-medium">Keputusan</th>
                    <th className="px-4 py-3 font-medium">Hasil</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.data.map((discussion) => (
                    <tr
                      key={discussion.id}
                      onClick={() => navigate(`/pembahasan/${discussion.id}`)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">
                        {formatDate(discussion.tanggal)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {discussion.lokasi ? (
                          <Link
                            to={`/lokasi/${discussion.lokasi.id}`}
                            onClick={(event) => event.stopPropagation()}
                            className="text-emerald-600 hover:text-emerald-700"
                          >
                            {discussion.lokasi.kode} — {discussion.lokasi.nama}
                          </Link>
                        ) : discussion.bidang ? (
                          <Link
                            to={`/bidang/${discussion.bidang.id}`}
                            onClick={(event) => event.stopPropagation()}
                            className="text-emerald-600 hover:text-emerald-700"
                          >
                            {discussion.bidang.kode}
                            {discussion.bidang.nomor_bidang
                              ? ` (No. ${discussion.bidang.nomor_bidang})`
                              : ''}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="max-w-[10rem] truncate px-4 py-3 text-sm text-slate-600">
                        {discussion.peserta}
                      </td>
                      <td className="px-4 py-3">
                        <DecisionBadge decision={discussion.keputusan} />
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-sm text-slate-600">
                        {discussion.hasil}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleDelete(discussion)
                          }}
                          disabled={deletingId === discussion.id}
                          className="text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingId === discussion.id ? 'Menghapus…' : 'Hapus'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              <span>
                Menampilkan {from}–{to} dari {result.total} pembahasan
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
