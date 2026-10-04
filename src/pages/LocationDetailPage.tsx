import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AcquisitionRecapSection from '../components/AcquisitionRecapSection'
import LocationGeometrySection from '../components/LocationGeometrySection'
import ParcelStatusBadge from '../components/ParcelStatusBadge'
import DiscussionHistorySection from '../components/DiscussionHistorySection'
import SurveyHistorySection from '../components/SurveyHistorySection'
import StatusBadge from '../components/StatusBadge'
import { useLocationDetail } from '../hooks/useLocations'
import { useParcelsByLocation } from '../hooks/useParcels'
import { formatDateTime, formatLuas } from '../lib/format'
import { locationService } from '../services/locationService'

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-sm text-slate-900">{value}</dd>
    </div>
  )
}

export default function LocationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { location, isLoading, error } = useLocationDetail(id)
  const {
    parcels,
    isLoading: parcelsLoading,
    error: parcelsError,
    reload: reloadParcels,
  } = useParcelsByLocation(location?.id)
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleDelete() {
    if (!location) return
    const confirmed = window.confirm(
      `Hapus lokasi ${location.kode} — ${location.nama}?\nTindakan ini tidak dapat dibatalkan.`,
    )
    if (!confirmed) return
    setIsDeleting(true)
    setActionError(null)
    try {
      await locationService.remove(location.id)
      navigate('/lokasi')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menghapus lokasi.')
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 p-16 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
        Memuat lokasi…
      </div>
    )
  }

  if (error || !location) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? 'Lokasi tidak ditemukan.'}
        </div>
        <Link
          to="/lokasi"
          className="inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali ke daftar lokasi
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
            <h1 className="text-2xl font-bold text-slate-900">{location.nama}</h1>
            <StatusBadge status={location.status} />
          </div>
          <p className="mt-1 font-mono text-sm text-slate-500">{location.kode}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/lokasi"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Kembali
          </Link>
          <Link
            to={`/lokasi/${location.id}/edit`}
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
          <div className="sm:col-span-2 lg:col-span-3">
            <DetailItem label="Alamat" value={location.alamat || '—'} />
          </div>
          <DetailItem label="Desa" value={location.desa || '—'} />
          <DetailItem label="Kecamatan" value={location.kecamatan || '—'} />
          <DetailItem label="Kabupaten" value={location.kabupaten || '—'} />
          <DetailItem label="Peruntukan" value={location.peruntukan || '—'} />
          <DetailItem label="Kondisi Lahan" value={location.kondisi_lahan || '—'} />
          <DetailItem label="Kondisi Pasar" value={location.kondisi_pasar || '—'} />
          <DetailItem label="Luas Target" value={formatLuas(location.luas_target)} />
          <DetailItem
            label="Luas Teridentifikasi"
            value={formatLuas(location.luas_teridentifikasi)}
          />
          <DetailItem label="Luas Deal" value={formatLuas(location.luas_deal)} />
          <div className="sm:col-span-2 lg:col-span-3">
            <DetailItem label="Catatan" value={location.catatan || '—'} />
          </div>
          <DetailItem label="Dibuat" value={formatDateTime(location.created_at)} />
          <DetailItem label="Terakhir Diubah" value={formatDateTime(location.updated_at)} />
        </dl>
      </div>

      <LocationGeometrySection
        locationId={location.id}
        locationKode={location.kode}
        locationNama={location.nama}
        onImportSuccess={reloadParcels}
      />

      <AcquisitionRecapSection locationId={location.id} />

      <DiscussionHistorySection
        locationId={location.id}
        newDiscussionHref={`/pembahasan/baru?lokasi=${location.id}`}
        emptyText={`Catat pembahasan pertama untuk lokasi ${location.kode}.`}
      />

      <SurveyHistorySection
        locationId={location.id}
        newSurveyHref={`/survey/baru?lokasi=${location.id}`}
        emptyText={`Catat hasil survey pertama untuk lokasi ${location.kode}.`}
      />

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Bidang Tanah ({parcels.length})
          </h2>
          <Link
            to={`/bidang/baru?lokasi=${location.id}`}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            + Tambah Bidang
          </Link>
        </div>

        {parcelsError ? (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {parcelsError}
          </div>
        ) : parcelsLoading ? (
          <div className="flex items-center justify-center gap-3 p-10 text-sm text-slate-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
            Memuat bidang tanah…
          </div>
        ) : parcels.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">Belum ada bidang di lokasi ini.</p>
            <p className="mt-1 text-sm text-slate-500">
              Tambahkan bidang tanah pertama untuk lokasi {location.kode}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3 font-medium">Kode</th>
                  <th className="px-6 py-3 font-medium">No. Bidang</th>
                  <th className="px-6 py-3 font-medium">Jenis Hak</th>
                  <th className="px-6 py-3 font-medium">Luas</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parcels.map((parcel) => (
                  <tr key={parcel.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-mono text-xs text-slate-700">{parcel.kode}</td>
                    <td className="px-6 py-3 text-sm text-slate-900">
                      {parcel.nomor_bidang || '—'}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600">
                      {parcel.jenis_hak || '—'}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600">{formatLuas(parcel.luas)}</td>
                    <td className="px-6 py-3">
                      <ParcelStatusBadge status={parcel.status_pembebasan} />
                    </td>
                    <td className="px-6 py-3 text-right">
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
        )}
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
        Batas wilayah (polygon) — editor peta akan disediakan pada modul Peta (AGENTS.md §17).
      </div>
    </div>
  )
}
