import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import FormField, { inputClass } from '../components/FormField'
import { useArchiveDetail } from '../hooks/useArchives'
import { locationService } from '../services/locationService'
import type { LocationOption } from '../services/locationService'
import { parcelService } from '../services/parcelService'
import type { ParcelOption } from '../services/parcelService'
import { projectService } from '../services/projectService'
import { archiveService } from '../services/archiveService'
import {
  ARCHIVE_RELATION_LABELS,
  ARCHIVE_RELATION_TYPES,
  ARCHIVE_STATUSES,
  ARCHIVE_STATUS_LABELS,
} from '../types/archive'
import type { ArchiveInput, ArchiveRelationType, ArchiveStatus } from '../types/archive'

interface FormState {
  kode: string
  namaDokumen: string
  kategori: string
  jenisDokumen: string
  nomorDokumen: string
  tanggalDokumen: string
  tipeRelasi: ArchiveRelationType
  locationId: string
  parcelId: string
  projectId: string
  gudang: string
  rak: string
  box: string
  folder: string
  status: ArchiveStatus
  catatan: string
}

const EMPTY_FORM: FormState = {
  kode: '',
  namaDokumen: '',
  kategori: '',
  jenisDokumen: '',
  nomorDokumen: '',
  tanggalDokumen: '',
  tipeRelasi: 'GENERAL',
  locationId: '',
  parcelId: '',
  projectId: '',
  gudang: '',
  rak: '',
  box: '',
  folder: '',
  status: 'TERSEDIA',
  catatan: '',
}

export default function ArchiveFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const { archive, isLoading, error } = useArchiveDetail(id)
  const [lokasiOptions, setLokasiOptions] = useState<LocationOption[]>([])
  const [bidangOptions, setBidangOptions] = useState<ParcelOption[]>([])
  const [projectOptions, setProjectOptions] = useState<{ id: string; kode: string; nama: string }[]>([])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    locationService
      .listOptions()
      .then((options) => {
        if (active) setLokasiOptions(options)
      })
      .catch(() => {})
    parcelService
      .listOptions()
      .then((options) => {
        if (active) setBidangOptions(options)
      })
      .catch(() => {})
    projectService
      .listOptions()
      .then((options) => {
        if (active) setProjectOptions(options)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (archive) {
      setForm({
        kode: archive.kode,
        namaDokumen: archive.nama_dokumen,
        kategori: archive.kategori ?? '',
        jenisDokumen: archive.jenis_dokumen ?? '',
        nomorDokumen: archive.nomor_dokumen ?? '',
        tanggalDokumen: archive.tanggal_dokumen ?? '',
        tipeRelasi: archive.tipe_relasi,
        locationId: archive.location_id ?? '',
        parcelId: archive.parcel_id ?? '',
        projectId: archive.project_id ?? '',
        gudang: archive.gudang ?? '',
        rak: archive.rak ?? '',
        box: archive.box ?? '',
        folder: archive.folder ?? '',
        status: archive.status,
        catatan: archive.catatan ?? '',
      })
    }
  }, [archive])

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setIsSubmitting(true)
    try {
      const input: ArchiveInput = {
        kode: form.kode,
        nama_dokumen: form.namaDokumen,
        kategori: form.kategori.trim() || null,
        jenis_dokumen: form.jenisDokumen.trim() || null,
        nomor_dokumen: form.nomorDokumen.trim() || null,
        tanggal_dokumen: form.tanggalDokumen || null,
        tipe_relasi: form.tipeRelasi,
        location_id: form.tipeRelasi === 'LOCATION' ? form.locationId || null : null,
        parcel_id: form.tipeRelasi === 'PARCEL' ? form.parcelId || null : null,
        project_id: form.tipeRelasi === 'PROJECT' ? form.projectId || null : null,
        gudang: form.gudang.trim() || null,
        rak: form.rak.trim() || null,
        box: form.box.trim() || null,
        folder: form.folder.trim() || null,
        status: form.status,
        catatan: form.catatan.trim() || null,
      }
      if (id) {
        await archiveService.update(id, input)
        navigate(`/arsip/${id}`)
      } else {
        const saved = await archiveService.create(input)
        navigate(`/arsip/${saved.id}`)
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan arsip.')
      setIsSubmitting(false)
    }
  }

  if (id && isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 p-16 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
        Memuat arsip…
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
          to="/arsip"
          className="inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali ke daftar arsip
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to={id ? `/arsip/${id}` : '/arsip'}
          className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {isEdit ? 'Ubah Arsip' : 'Tambah Arsip'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isEdit ? 'Perbarui data arsip.' : 'Isi data arsip baru.'}
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
            placeholder="ARS-2026-001"
          />
          <FormField
            label="Nama Dokumen"
            value={form.namaDokumen}
            onChange={(value) => setField('namaDokumen', value)}
            required
            placeholder="Nama dokumen arsip"
          />
          <FormField
            label="Kategori"
            value={form.kategori}
            onChange={(value) => setField('kategori', value)}
          />
          <FormField
            label="Jenis Dokumen"
            value={form.jenisDokumen}
            onChange={(value) => setField('jenisDokumen', value)}
          />
          <FormField
            label="Nomor Dokumen"
            value={form.nomorDokumen}
            onChange={(value) => setField('nomorDokumen', value)}
          />
          <FormField
            label="Tanggal Dokumen"
            value={form.tanggalDokumen}
            onChange={(value) => setField('tanggalDokumen', value)}
            type="date"
          />

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Tipe Relasi<span className="text-red-500"> *</span>
            </label>
            <div className="flex flex-wrap gap-4">
              {ARCHIVE_RELATION_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="tipe-relasi"
                    checked={form.tipeRelasi === type}
                    onChange={() => setField('tipeRelasi', type)}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  {ARCHIVE_RELATION_LABELS[type]}
                </label>
              ))}
            </div>
          </div>

          {form.tipeRelasi === 'LOCATION' && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Lokasi<span className="text-red-500"> *</span>
              </label>
              <select
                value={form.locationId}
                onChange={(event) => setField('locationId', event.target.value)}
                required
                className={inputClass}
              >
                <option value="">— Pilih lokasi —</option>
                {lokasiOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.kode} — {option.nama}
                  </option>
                ))}
              </select>
            </div>
          )}
          {form.tipeRelasi === 'PARCEL' && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Bidang Tanah<span className="text-red-500"> *</span>
              </label>
              <select
                value={form.parcelId}
                onChange={(event) => setField('parcelId', event.target.value)}
                required
                className={inputClass}
              >
                <option value="">— Pilih bidang —</option>
                {bidangOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.kode}
                    {option.nomor_bidang ? ` (No. ${option.nomor_bidang})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          {form.tipeRelasi === 'PROJECT' && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Project<span className="text-red-500"> *</span>
              </label>
              <select
                value={form.projectId}
                onChange={(event) => setField('projectId', event.target.value)}
                required
                className={inputClass}
              >
                <option value="">— Pilih project —</option>
                {projectOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.kode} — {option.nama}
                  </option>
                ))}
              </select>
            </div>
          )}
          {form.tipeRelasi === 'GENERAL' && (
            <p className="text-xs text-slate-400 sm:col-span-2">
              Arsip umum tidak terkait lokasi, bidang, maupun project.
            </p>
          )}

          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-slate-700">Lokasi Fisik</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Gudang" value={form.gudang} onChange={(value) => setField('gudang', value)} />
              <FormField label="Rak" value={form.rak} onChange={(value) => setField('rak', value)} />
              <FormField label="Box" value={form.box} onChange={(value) => setField('box', value)} />
              <FormField label="Folder" value={form.folder} onChange={(value) => setField('folder', value)} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
            <select
              value={form.status}
              onChange={(event) => setField('status', event.target.value as ArchiveStatus)}
              className={inputClass}
            >
              {ARCHIVE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {ARCHIVE_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <FormField
            label="Catatan"
            value={form.catatan}
            onChange={(value) => setField('catatan', value)}
            textarea
            full
          />
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Kode mengikuti format ARS-YYYY-NNN (contoh: ARS-2026-001).
        </p>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
          <Link
            to={id ? `/arsip/${id}` : '/arsip'}
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
