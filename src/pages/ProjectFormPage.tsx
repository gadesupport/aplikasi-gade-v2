import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import FormField, { inputClass } from '../components/FormField'
import { useProjectDetail } from '../hooks/useProjects'
import { projectService } from '../services/projectService'
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from '../types/project'
import type { ProjectInput, ProjectStatus } from '../types/project'

interface FormState {
  kode: string
  nama: string
  lokasi: string
  desa: string
  kecamatan: string
  kabupaten: string
  status: ProjectStatus
  keterangan: string
}

const EMPTY_FORM: FormState = {
  kode: '',
  nama: '',
  lokasi: '',
  desa: '',
  kecamatan: '',
  kabupaten: '',
  status: 'PERENCANAAN',
  keterangan: '',
}

export default function ProjectFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const { project, isLoading, error } = useProjectDetail(id)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (project) {
      setForm({
        kode: project.kode,
        nama: project.nama,
        lokasi: project.lokasi ?? '',
        desa: project.desa ?? '',
        kecamatan: project.kecamatan ?? '',
        kabupaten: project.kabupaten ?? '',
        status: project.status,
        keterangan: project.keterangan ?? '',
      })
    }
  }, [project])

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }) as FormState)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setIsSubmitting(true)
    try {
      const input: ProjectInput = {
        kode: form.kode,
        nama: form.nama,
        lokasi: form.lokasi.trim() || null,
        desa: form.desa.trim() || null,
        kecamatan: form.kecamatan.trim() || null,
        kabupaten: form.kabupaten.trim() || null,
        status: form.status,
        keterangan: form.keterangan.trim() || null,
      }
      if (id) {
        await projectService.update(id, input)
        navigate(`/project/${id}`)
      } else {
        const saved = await projectService.create(input)
        navigate(`/project/${saved.id}`)
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan project.')
      setIsSubmitting(false)
    }
  }

  if (id && isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 p-16 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
        Memuat project…
      </div>
    )
  }

  if (id && error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to={id ? `/project/${id}` : '/project'}
          className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {isEdit ? 'Ubah Project' : 'Tambah Project'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isEdit ? 'Perbarui data project.' : 'Isi data project baru.'}
        </p>
      </div>

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Kode"
            value={form.kode}
            onChange={(value) => setField('kode', value)}
            required
            placeholder="PRJ-2026-001"
          />
          <FormField
            label="Nama"
            value={form.nama}
            onChange={(value) => setField('nama', value)}
            required
            placeholder="Nama project"
          />
          <FormField label="Lokasi" value={form.lokasi} onChange={(value) => setField('lokasi', value)} full />
          <FormField label="Desa" value={form.desa} onChange={(value) => setField('desa', value)} />
          <FormField
            label="Kecamatan"
            value={form.kecamatan}
            onChange={(value) => setField('kecamatan', value)}
          />
          <FormField
            label="Kabupaten"
            value={form.kabupaten}
            onChange={(value) => setField('kabupaten', value)}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
            <select
              value={form.status}
              onChange={(event) => setField('status', event.target.value)}
              className={inputClass}
            >
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PROJECT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <FormField
            label="Keterangan"
            value={form.keterangan}
            onChange={(value) => setField('keterangan', value)}
            textarea
            full
          />
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Kode mengikuti format PRJ-YYYY-NNN (contoh: PRJ-2026-001).
        </p>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
          <Link
            to={id ? `/project/${id}` : '/project'}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  )
}
