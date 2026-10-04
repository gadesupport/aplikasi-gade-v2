import { Link } from 'react-router-dom'
import { useSurveysByLocation, useSurveysByParcel } from '../hooks/useSurveys'
import { formatDate } from '../lib/format'

interface SurveyHistorySectionProps {
  locationId?: string
  parcelId?: string
  // Path form survey dengan prefill target (mis. "/survey/baru?lokasi=...")
  newSurveyHref: string
  emptyText: string
}

// Section "Riwayat Survey" pada halaman detail lokasi/bidang (§8: simpan
// histori). Menampilkan maksimal 50 survey terbaru terkait target.
export default function SurveyHistorySection({
  locationId,
  parcelId,
  newSurveyHref,
  emptyText,
}: SurveyHistorySectionProps) {
  const locationState = useSurveysByLocation(locationId)
  const parcelState = useSurveysByParcel(parcelId)
  const surveys = locationId ? locationState.surveys : parcelState.surveys
  const isLoading = locationId ? locationState.isLoading : parcelState.isLoading
  const error = locationId ? locationState.error : parcelState.error

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">Riwayat Survey ({surveys.length})</h2>
        <Link
          to={newSurveyHref}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          + Tambah Survey
        </Link>
      </div>

      {error ? (
        <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-3 p-10 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
          Memuat riwayat survey…
        </div>
      ) : surveys.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm font-medium text-slate-700">Belum ada survey.</p>
          <p className="mt-1 text-sm text-slate-500">{emptyText}</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {surveys.map((survey) => (
            <li key={survey.id} className="px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {formatDate(survey.tanggal_survey)} — {survey.surveyor}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{survey.hasil_survey}</p>
                  {survey.latitude !== null && survey.longitude !== null && (
                    <p className="mt-0.5 font-mono text-xs text-slate-400">
                      {survey.latitude.toFixed(6)}, {survey.longitude.toFixed(6)}
                    </p>
                  )}
                </div>
                <Link
                  to={`/survey/${survey.id}`}
                  className="shrink-0 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                >
                  Detail
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
