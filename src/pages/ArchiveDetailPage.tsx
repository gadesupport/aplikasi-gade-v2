import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArchiveRelationBadge, ArchiveStatusBadge } from '../components/ArchiveBadges'
import ArchiveDocumentsSection from '../components/ArchiveDocumentsSection'
import HandoversSection from '../components/HandoversSection'
import { useArchiveDetail } from '../hooks/useArchives'
import { formatDate, formatDateTime } from '../lib/format'
import { archiveService } from '../services/archiveService'

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-sm text-slate-900">{value}</dd>
    </div>
  )
}

export default function ArchiveDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { archive, isLoading, error, reload } = useArchiveDetail(id)
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleDelete() {
    if (!archive) return
    const confirmed = window.confirm(
      `Hapus arsip ${archive.kode} — ${archive.nama_dokumen}?\nTindakan ini tidak dapat dibatalkan.`,
    )
    if (!confirmed) return
    setIsDeleting(true)
    setActionError(null)
    try {
      await archiveService.remove(archive.id)
      navigate('/arsip')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menghapus arsip.')
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 p-16 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
        Memuat arsip…
      </div>
    )
  }

  if (error || !archive) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? 'Arsip tidak ditemukan.'}
        </div>
        <Link
          to="/arsip"
          className="inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali ke daftar arsip
        </Link>
      </div>
    )
  }

  const relationTarget = archive.locations ? (
    <Link to={`/lokasi/${archive.locations.id}`} className="text-emerald-600 hover:text-emerald-700">
      {archive.locations.kode} — {archive.locations.nama}
    </Link>
  ) : archive.land_parcels ? (
    <Link to={`/bidang/${archive.land_parcels.id}`} className="text-emerald-600 hover:text-emerald-700">
      {archive.land_parcels.kode}
      {archive.land_parcels.nomor_bidang ? ` (No. ${archive.land_parcels.nomor_bidang})` : ''}
    </Link>
  ) : archive.projects ? (
    <Link to={`/project/${archive.projects.id}`} className="text-emerald-600 hover:text-emerald-700">
      {archive.projects.kode} — {archive.projects.nama}
    </Link>
  ) : (
    '—'
  )

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
            <h1 className="text-2xl font-bold text-slate-900">{archive.nama_dokumen}</h1>
            <ArchiveStatusBadge status={archive.status} />
            <ArchiveRelationBadge type={archive.tipe_relasi} />
          </div>
          <p className="mt-1 font-mono text-sm text-slate-500">{archive.kode}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/arsip"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Kembali
          </Link>
          <Link
            to={`/arsip/${archive.id}/edit`}
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
          <DetailItem label="Relasi" value={relationTarget} />
          <DetailItem label="Kategori" value={archive.kategori || '—'} />
          <DetailItem label="Jenis Dokumen" value={archive.jenis_dokumen || '—'} />
          <DetailItem label="Nomor Dokumen" value={archive.nomor_dokumen || '—'} />
          <DetailItem label="Tanggal Dokumen" value={formatDate(archive.tanggal_dokumen)} />
          <div className="sm:col-span-2 lg:col-span-3">
            <DetailItem label="Catatan" value={archive.catatan || '—'} />
          </div>
          <DetailItem label="Dibuat" value={formatDateTime(archive.created_at)} />
          <DetailItem label="Terakhir Diubah" value={formatDateTime(archive.updated_at)} />
        </dl>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Lokasi Fisik</h2>
        </div>
        <div className="p-6">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <DetailItem label="Gudang" value={archive.gudang || '—'} />
            <DetailItem label="Rak" value={archive.rak || '—'} />
            <DetailItem label="Box" value={archive.box || '—'} />
            <DetailItem label="Folder" value={archive.folder || '—'} />
          </dl>
        </div>
      </div>

      <ArchiveDocumentsSection archiveId={archive.id} />

      <HandoversSection archiveId={archive.id} onArchiveStatusChanged={reload} />
    </div>
  )
}
