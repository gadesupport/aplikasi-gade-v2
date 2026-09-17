import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import LegalitiesSection from '../components/LegalitiesSection'
import ParcelGeometrySection from '../components/ParcelGeometrySection'
import ParcelPartiesSection from '../components/ParcelPartiesSection'
import ParcelStatusBadge from '../components/ParcelStatusBadge'
import { useParcelDetail } from '../hooks/useParcels'
import { formatDate, formatDateTime, formatLuas, formatRupiah } from '../lib/format'
import { parcelService } from '../services/parcelService'

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-sm text-slate-900">{value}</dd>
    </div>
  )
}

export default function ParcelDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { parcel, isLoading, error } = useParcelDetail(id)
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleDelete() {
    if (!parcel) return
    const confirmed = window.confirm(
      `Hapus bidang ${parcel.kode}?\nTindakan ini tidak dapat dibatalkan.`,
    )
    if (!confirmed) return
    setIsDeleting(true)
    setActionError(null)
    try {
      await parcelService.remove(parcel.id)
      navigate('/bidang')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menghapus bidang tanah.')
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 p-16 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
        Memuat bidang tanah…
      </div>
    )
  }

  if (error || !parcel) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? 'Bidang tanah tidak ditemukan.'}
        </div>
        <Link
          to="/bidang"
          className="inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali ke daftar bidang tanah
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
            <h1 className="text-2xl font-bold text-slate-900">Bidang {parcel.kode}</h1>
            <ParcelStatusBadge status={parcel.status_pembebasan} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Lokasi:{' '}
            {parcel.lokasi ? (
              <Link
                to={`/lokasi/${parcel.lokasi.id}`}
                className="font-medium text-emerald-600 hover:text-emerald-700"
              >
                {parcel.lokasi.kode} — {parcel.lokasi.nama}
              </Link>
            ) : (
              '—'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/bidang"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Kembali
          </Link>
          <Link
            to={`/bidang/${parcel.id}/edit`}
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
          <DetailItem label="Nomor Bidang" value={parcel.nomor_bidang || '—'} />
          <DetailItem label="Luas" value={formatLuas(parcel.luas)} />
          <DetailItem label="Jenis Hak" value={parcel.jenis_hak || '—'} />
          <DetailItem label="Nomor Hak" value={parcel.nomor_hak || '—'} />
          <DetailItem label="Harga Penawaran" value={formatRupiah(parcel.harga_penawaran)} />
          <DetailItem label="Harga Kesepakatan" value={formatRupiah(parcel.harga_kesepakatan)} />
          <DetailItem label="Tanggal Kesepakatan" value={formatDate(parcel.tanggal_kesepakatan)} />
          <div className="sm:col-span-2 lg:col-span-3">
            <DetailItem label="Catatan" value={parcel.catatan || '—'} />
          </div>
          <DetailItem label="Dibuat" value={formatDateTime(parcel.created_at)} />
          <DetailItem label="Terakhir Diubah" value={formatDateTime(parcel.updated_at)} />
        </dl>
      </div>

      <ParcelGeometrySection parcelId={parcel.id} locationId={parcel.lokasi_id} />

      <LegalitiesSection parcelId={parcel.id} />

      <ParcelPartiesSection parcelId={parcel.id} />
    </div>
  )
}
