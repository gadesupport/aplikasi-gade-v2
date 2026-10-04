import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import DecisionBadge from '../components/DecisionBadge'
import { useDiscussionDetail } from '../hooks/useDiscussions'
import { formatDate, formatDateTime } from '../lib/format'
import { discussionService } from '../services/discussionService'
import { DISCUSSION_DECISION_LABELS } from '../types/discussion'

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-sm text-slate-900">{value}</dd>
    </div>
  )
}

export default function DiscussionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { discussion, isLoading, error } = useDiscussionDetail(id)
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleDelete() {
    if (!discussion) return
    const confirmed = window.confirm(
      `Hapus pembahasan ${formatDate(discussion.tanggal)} (${discussion.keputusan})?`,
    )
    if (!confirmed) return
    setIsDeleting(true)
    setActionError(null)
    try {
      await discussionService.remove(discussion.id)
      navigate('/pembahasan')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menghapus pembahasan.')
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 p-16 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
        Memuat pembahasan…
      </div>
    )
  }

  if (error || !discussion) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? 'Pembahasan tidak ditemukan.'}
        </div>
        <Link
          to="/pembahasan"
          className="inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali ke daftar pembahasan
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              Pembahasan {formatDate(discussion.tanggal)}
            </h1>
            <DecisionBadge decision={discussion.keputusan} />
          </div>
          <p className="mt-1 text-sm text-slate-500">Peserta: {discussion.peserta}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/pembahasan"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Kembali
          </Link>
          <Link
            to={`/pembahasan/${discussion.id}/edit`}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Ubah
          </Link>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? 'Menghapus…' : 'Hapus'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem
            label="Target"
            value={
              discussion.lokasi ? (
                <Link
                  to={`/lokasi/${discussion.lokasi.id}`}
                  className="text-emerald-600 hover:text-emerald-700"
                >
                  Lokasi: {discussion.lokasi.kode} — {discussion.lokasi.nama}
                </Link>
              ) : discussion.bidang ? (
                <Link
                  to={`/bidang/${discussion.bidang.id}`}
                  className="text-emerald-600 hover:text-emerald-700"
                >
                  Bidang: {discussion.bidang.kode}
                  {discussion.bidang.nomor_bidang ? ` (No. ${discussion.bidang.nomor_bidang})` : ''}
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DetailItem label="Tanggal" value={formatDate(discussion.tanggal)} />
          <DetailItem label="Peserta" value={discussion.peserta} />
          <div className="sm:col-span-2 lg:col-span-3">
            <DetailItem label="Hasil Pembahasan" value={discussion.hasil} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <DetailItem label="Catatan" value={discussion.catatan || '—'} />
          </div>
          <DetailItem label="Dibuat" value={formatDateTime(discussion.created_at)} />
          <DetailItem label="Terakhir Diubah" value={formatDateTime(discussion.updated_at)} />
        </dl>
      </div>

      <p className="text-xs text-slate-400">
        Keputusan {DISCUSSION_DECISION_LABELS[discussion.keputusan]} —{' '}
        {discussion.keputusan === 'TIDAK_LAYAK'
          ? 'status target otomatis menjadi DITOLAK.'
          : discussion.keputusan === 'PERLU_KAJIAN'
            ? 'status target otomatis menjadi DITUNDA.'
            : 'status target tidak berubah.'}
      </p>
    </div>
  )
}
