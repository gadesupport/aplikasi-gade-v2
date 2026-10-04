import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSurveyDetail } from '../hooks/useSurveys'
import { formatDate, formatDateTime } from '../lib/format'
import { surveyService } from '../services/surveyService'

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-sm text-slate-900">{value}</dd>
    </div>
  )
}

export default function SurveyDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { survey, isLoading, error } = useSurveyDetail(id)
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleDelete() {
    if (!survey) return
    const confirmed = window.confirm(
      `Hapus survey ${formatDate(survey.tanggal_survey)} oleh ${survey.surveyor}?`,
    )
    if (!confirmed) return
    setIsDeleting(true)
    setActionError(null)
    try {
      await surveyService.remove(survey.id)
      navigate('/survey')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menghapus survey.')
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 p-16 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
        Memuat survey…
      </div>
    )
  }

  if (error || !survey) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? 'Data survey tidak ditemukan.'}
        </div>
        <Link
          to="/survey"
          className="inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali ke daftar survey
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
          <h1 className="text-2xl font-bold text-slate-900">
            Survey {formatDate(survey.tanggal_survey)}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Surveyor: {survey.surveyor}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/survey"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Kembali
          </Link>
          <Link
            to={`/survey/${survey.id}/edit`}
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
            label="Target Survey"
            value={
              survey.lokasi ? (
                <Link
                  to={`/lokasi/${survey.lokasi.id}`}
                  className="text-emerald-600 hover:text-emerald-700"
                >
                  Lokasi: {survey.lokasi.kode} — {survey.lokasi.nama}
                </Link>
              ) : survey.bidang ? (
                <Link
                  to={`/bidang/${survey.bidang.id}`}
                  className="text-emerald-600 hover:text-emerald-700"
                >
                  Bidang: {survey.bidang.kode}
                  {survey.bidang.nomor_bidang ? ` (No. ${survey.bidang.nomor_bidang})` : ''}
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DetailItem label="Tanggal Survey" value={formatDate(survey.tanggal_survey)} />
          <DetailItem label="Surveyor" value={survey.surveyor} />
          <div className="sm:col-span-2 lg:col-span-3">
            <DetailItem label="Hasil Survey" value={survey.hasil_survey} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <DetailItem label="Catatan" value={survey.catatan || '—'} />
          </div>
          <DetailItem
            label="Koordinat GPS"
            value={
              survey.latitude !== null && survey.longitude !== null
                ? `${survey.latitude.toFixed(6)}, ${survey.longitude.toFixed(6)}`
                : '—'
            }
          />
          <DetailItem label="Dibuat" value={formatDateTime(survey.created_at)} />
          <DetailItem label="Terakhir Diubah" value={formatDateTime(survey.updated_at)} />
        </dl>
      </div>
    </div>
  )
}
