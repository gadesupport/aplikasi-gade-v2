import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import FormField, { inputClass } from '../components/FormField'
import { useDiscussionDetail } from '../hooks/useDiscussions'
import { locationService } from '../services/locationService'
import type { LocationOption } from '../services/locationService'
import { parcelService } from '../services/parcelService'
import type { ParcelOption } from '../services/parcelService'
import { discussionService } from '../services/discussionService'
import {
  DISCUSSION_DECISIONS,
  DISCUSSION_DECISION_LABELS,
  DISCUSSION_DECISION_EFFECTS,
} from '../types/discussion'
import type { DiscussionDecision, DiscussionInput } from '../types/discussion'

type TargetMode = 'lokasi' | 'bidang'

interface FormState {
  targetMode: TargetMode
  lokasiId: string
  bidangId: string
  tanggal: string
  peserta: string
  hasil: string
  keputusan: DiscussionDecision
  catatan: string
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function DiscussionFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const { discussion, isLoading, error } = useDiscussionDetail(id)
  const [lokasiOptions, setLokasiOptions] = useState<LocationOption[]>([])
  const [bidangOptions, setBidangOptions] = useState<ParcelOption[]>([])
  const [form, setForm] = useState<FormState>(() => ({
    targetMode: searchParams.get('bidang') ? 'bidang' : 'lokasi',
    lokasiId: searchParams.get('lokasi') ?? '',
    bidangId: searchParams.get('bidang') ?? '',
    tanggal: todayIso(),
    peserta: '',
    hasil: '',
    keputusan: 'LAYAK',
    catatan: '',
  }))
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
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (discussion) {
      setForm({
        targetMode: discussion.bidang_id ? 'bidang' : 'lokasi',
        lokasiId: discussion.lokasi_id ?? '',
        bidangId: discussion.bidang_id ?? '',
        tanggal: discussion.tanggal,
        peserta: discussion.peserta,
        hasil: discussion.hasil,
        keputusan: discussion.keputusan,
        catatan: discussion.catatan ?? '',
      })
    }
  }, [discussion])

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setIsSubmitting(true)
    try {
      if (id) {
        await discussionService.update(id, {
          tanggal: form.tanggal,
          peserta: form.peserta,
          hasil: form.hasil,
          keputusan: form.keputusan,
          catatan: form.catatan.trim() || null,
        })
        navigate(`/pembahasan/${id}`)
      } else {
        const lokasiId = form.targetMode === 'lokasi' ? form.lokasiId : ''
        const bidangId = form.targetMode === 'bidang' ? form.bidangId : ''
        const input: DiscussionInput = {
          lokasi_id: lokasiId || null,
          bidang_id: bidangId || null,
          tanggal: form.tanggal,
          peserta: form.peserta,
          hasil: form.hasil,
          keputusan: form.keputusan,
          catatan: form.catatan.trim() || null,
        }
        const saved = await discussionService.create(input)
        navigate(`/pembahasan/${saved.id}`)
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan pembahasan.')
      setIsSubmitting(false)
    }
  }

  if (id && isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 p-16 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
        Memuat pembahasan…
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
          to="/pembahasan"
          className="inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali ke daftar pembahasan
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to={id ? `/pembahasan/${id}` : '/pembahasan'}
          className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {isEdit ? 'Ubah Pembahasan' : 'Tambah Pembahasan'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isEdit
            ? 'Perbarui pembahasan — efek status target dihitung ulang dari keputusan.'
            : 'Catat pembahasan lokasi/bidang beserta keputusannya.'}
        </p>
      </div>

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {!isEdit && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Target<span className="text-red-500"> *</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="target-mode"
                      checked={form.targetMode === 'lokasi'}
                      onChange={() => setField('targetMode', 'lokasi')}
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    Lokasi
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="target-mode"
                      checked={form.targetMode === 'bidang'}
                      onChange={() => setField('targetMode', 'bidang')}
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    Bidang
                  </label>
                </div>
              </div>

              {form.targetMode === 'lokasi' ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Lokasi<span className="text-red-500"> *</span>
                  </label>
                  <select
                    value={form.lokasiId}
                    onChange={(event) => setField('lokasiId', event.target.value)}
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
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Bidang<span className="text-red-500"> *</span>
                  </label>
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
                </div>
              )}
            </>
          )}

          <FormField
            label="Tanggal"
            value={form.tanggal}
            onChange={(value) => setField('tanggal', value)}
            type="date"
            required
          />
          <FormField
            label="Peserta"
            value={form.peserta}
            onChange={(value) => setField('peserta', value)}
            required
            placeholder="Nama-nama peserta pembahasan"
          />

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Hasil Pembahasan<span className="text-red-500"> *</span>
            </label>
            <textarea
              value={form.hasil}
              onChange={(event) => setField('hasil', event.target.value)}
              rows={4}
              required
              placeholder="Ringkasan pembahasan dan kesepakatan…"
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Keputusan<span className="text-red-500"> *</span>
            </label>
            <div className="space-y-2">
              {DISCUSSION_DECISIONS.map((decision) => (
                <label
                  key={decision}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                    form.keputusan === decision ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="keputusan"
                    checked={form.keputusan === decision}
                    onChange={() => setField('keputusan', decision)}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-medium text-slate-700">
                    {DISCUSSION_DECISION_LABELS[decision]}
                  </span>
                  <span className="text-xs text-slate-400">
                    {DISCUSSION_DECISION_EFFECTS[decision]}
                  </span>
                </label>
              ))}
            </div>
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
            to={id ? `/pembahasan/${id}` : '/pembahasan'}
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
