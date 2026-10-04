import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import FormField, { inputClass } from '../components/FormField'
import { legalityService } from '../services/legalityService'
import { partyService } from '../services/partyService'
import type { PartyRef } from '../types/party'
import {
  LEGALITY_DOC_TYPES,
  LEGALITY_DOC_TYPE_LABELS,
  LEGALITY_STATUSES,
  LEGALITY_STATUS_LABELS,
} from '../types/legality'
import type { LegalityDocType, LegalityInput, LegalityStatus } from '../types/legality'

interface FormState {
  bidangId: string
  jenis: LegalityDocType
  nomor: string
  tanggal: string
  penerbit: string
  status: LegalityStatus
  pihakId: string
  catatan: string
}

export default function LegalityFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [bidangOptions, setBidangOptions] = useState<{ id: string; kode: string; nomor_bidang: string | null }[]>([])
  const [partyOptions, setPartyOptions] = useState<PartyRef[]>([])
  const [existing, setExisting] = useState<{
    bidang_id: string
    jenis_dokumen: LegalityDocType
    nomor_dokumen: string | null
    tanggal_dokumen: string | null
    penerbit: string | null
    status: LegalityStatus
    pihak_id: string | null
    catatan: string | null
  } | null>(null)
  const [isLoading, setIsLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<FormState>(() => ({
    bidangId: '',
    jenis: 'SERTIFIKAT',
    nomor: '',
    tanggal: '',
    penerbit: '',
    status: 'BELUM_ADA',
    pihakId: '',
    catatan: '',
  }))

  useEffect(() => {
    let active = true
    import('../services/parcelService').then(({ parcelService }) =>
      parcelService
        .listOptions()
        .then((options) => {
          if (active) setBidangOptions(options)
        })
        .catch(() => {}),
    )
    partyService
      .listOptions()
      .then((options) => {
        if (active) setPartyOptions(options)
      })
      .catch(() => {})
    if (id) {
      legalityService
        .getById(id)
        .then((row) => {
          if (active) {
            setExisting({
              bidang_id: row.bidang_id,
              jenis_dokumen: row.jenis_dokumen,
              nomor_dokumen: row.nomor_dokumen,
              tanggal_dokumen: row.tanggal_dokumen,
              penerbit: row.penerbit,
              status: row.status,
              pihak_id: row.pihak_id,
              catatan: row.catatan,
            })
            setForm({
              bidangId: row.bidang_id,
              jenis: row.jenis_dokumen,
              nomor: row.nomor_dokumen ?? '',
              tanggal: row.tanggal_dokumen ?? '',
              penerbit: row.penerbit ?? '',
              status: row.status,
              pihakId: row.pihak_id ?? '',
              catatan: row.catatan ?? '',
            })
            setIsLoading(false)
          }
        })
        .catch((err) => {
          if (active) {
            setLoadError(err instanceof Error ? err.message : 'Gagal memuat legalitas.')
            setIsLoading(false)
          }
        })
    }
    return () => {
      active = false
    }
  }, [id])

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setIsSubmitting(true)
    try {
      const input: LegalityInput = {
        bidang_id: form.bidangId,
        pihak_id: form.pihakId || null,
        jenis_dokumen: form.jenis,
        nomor_dokumen: form.nomor.trim() || null,
        tanggal_dokumen: form.tanggal || null,
        penerbit: form.penerbit.trim() || null,
        status: form.status,
        catatan: form.catatan.trim() || null,
      }
      if (id) {
        await legalityService.update(id, input)
      } else {
        await legalityService.create(input)
      }
      navigate('/legalitas')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan legalitas.')
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 p-16 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
        Memuat legalitas…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
        <Link
          to="/legalitas"
          className="inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali ke daftar legalitas
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to="/legalitas"
          className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {isEdit ? 'Ubah Legalitas' : 'Tambah Legalitas'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isEdit
            ? 'Perbarui data legalitas. Checklist per bidang tetap tersedia di halaman detail bidang.'
            : 'Isi data legalitas pada level bidang.'}
        </p>
      </div>

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Bidang Tanah<span className="text-red-500"> *</span>
              {isEdit && existing && (
                <span className="ml-2 text-xs text-slate-400">(tidak dapat diubah)</span>
              )}
            </label>
            {isEdit ? (
              <input
                type="text"
                disabled
                value={
                  bidangOptions.find((option) => option.id === form.bidangId)?.kode ??
                  'Bidang terpilih'
                }
                className={`${inputClass} bg-slate-50`}
              />
            ) : (
              <select
                value={form.bidangId}
                onChange={(event) => setField('bidangId', event.target.value)}
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
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Jenis Dokumen<span className="text-red-500"> *</span>
            </label>
            <select
              value={form.jenis}
              onChange={(event) => setField('jenis', event.target.value as LegalityDocType)}
              className={inputClass}
            >
              {LEGALITY_DOC_TYPES.map((jenis) => (
                <option key={jenis} value={jenis}>
                  {LEGALITY_DOC_TYPE_LABELS[jenis]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Status<span className="text-red-500"> *</span>
            </label>
            <select
              value={form.status}
              onChange={(event) => setField('status', event.target.value as LegalityStatus)}
              className={inputClass}
            >
              {LEGALITY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {LEGALITY_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          <FormField
            label="Nomor Dokumen"
            value={form.nomor}
            onChange={(value) => setField('nomor', value)}
            placeholder="Nomor dokumen"
          />
          <FormField
            label="Tanggal Dokumen"
            value={form.tanggal}
            onChange={(value) => setField('tanggal', value)}
            type="date"
          />
          <FormField
            label="Penerbit"
            value={form.penerbit}
            onChange={(value) => setField('penerbit', value)}
            placeholder="Instansi/penerbit dokumen"
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Pihak Terkait</label>
            <select
              value={form.pihakId}
              onChange={(event) => setField('pihakId', event.target.value)}
              className={inputClass}
            >
              <option value="">— Tanpa pihak —</option>
              {partyOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.nama}
                  {option.nik ? ` — ${option.nik}` : ''}
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

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
          <Link
            to="/legalitas"
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
