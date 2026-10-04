import { Link } from 'react-router-dom'
import DecisionBadge from './DecisionBadge'
import { useDiscussionsByLocation, useDiscussionsByParcel } from '../hooks/useDiscussions'
import { formatDate } from '../lib/format'

interface DiscussionHistorySectionProps {
  locationId?: string
  parcelId?: string
  // Path form pembahasan dengan prefill target (mis. "/pembahasan/baru?lokasi=...")
  newDiscussionHref: string
  emptyText: string
}

// Section "Histori Pembahasan" pada halaman detail lokasi/bidang (§9).
export default function DiscussionHistorySection({
  locationId,
  parcelId,
  newDiscussionHref,
  emptyText,
}: DiscussionHistorySectionProps) {
  const locationState = useDiscussionsByLocation(locationId)
  const parcelState = useDiscussionsByParcel(parcelId)
  const discussions = locationId ? locationState.discussions : parcelState.discussions
  const isLoading = locationId ? locationState.isLoading : parcelState.isLoading
  const error = locationId ? locationState.error : parcelState.error

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">
          Histori Pembahasan ({discussions.length})
        </h2>
        <Link
          to={newDiscussionHref}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          + Tambah Pembahasan
        </Link>
      </div>

      {error ? (
        <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-3 p-10 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
          Memuat histori pembahasan…
        </div>
      ) : discussions.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm font-medium text-slate-700">Belum ada pembahasan.</p>
          <p className="mt-1 text-sm text-slate-500">{emptyText}</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {discussions.map((discussion) => (
            <li key={discussion.id} className="px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      {formatDate(discussion.tanggal)}
                    </span>
                    <DecisionBadge decision={discussion.keputusan} />
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">Peserta: {discussion.peserta}</p>
                  <p className="line-clamp-2 text-sm text-slate-500">{discussion.hasil}</p>
                </div>
                <Link
                  to={`/pembahasan/${discussion.id}`}
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
