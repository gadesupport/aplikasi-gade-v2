import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ProjectStatusBadge from '../components/ProjectStatusBadge'
import { useProjectDetail } from '../hooks/useProjects'
import { formatDateTime } from '../lib/format'
import { projectService } from '../services/projectService'

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-sm text-slate-900">{value}</dd>
    </div>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { project, isLoading, error } = useProjectDetail(id)
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleDelete() {
    if (!project) return
    const confirmed = window.confirm(
      `Hapus project ${project.kode} — ${project.nama}?\nTindakan ini tidak dapat dibatalkan.`,
    )
    if (!confirmed) return
    setIsDeleting(true)
    setActionError(null)
    try {
      await projectService.remove(project.id)
      navigate('/project')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menghapus project.')
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 p-16 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
        Memuat project…
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? 'Project tidak ditemukan.'}
        </div>
        <Link
          to="/project"
          className="inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali ke daftar project
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
            <h1 className="text-2xl font-bold text-slate-900">{project.nama}</h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <p className="mt-1 font-mono text-sm text-slate-500">{project.kode}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/project"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Kembali
          </Link>
          <Link
            to={`/project/${project.id}/edit`}
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
            <DetailItem label="Lokasi" value={project.lokasi || '—'} />
          </div>
          <DetailItem label="Desa" value={project.desa || '—'} />
          <DetailItem label="Kecamatan" value={project.kecamatan || '—'} />
          <DetailItem label="Kabupaten" value={project.kabupaten || '—'} />
          <div className="sm:col-span-2 lg:col-span-3">
            <DetailItem label="Keterangan" value={project.keterangan || '—'} />
          </div>
          <DetailItem label="Dibuat" value={formatDateTime(project.created_at)} />
          <DetailItem label="Terakhir Diubah" value={formatDateTime(project.updated_at)} />
        </dl>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
        Dokumen & arsip project akan tersedia pada modul Arsip (AGENTS.md §12).
      </div>
    </div>
  )
}
