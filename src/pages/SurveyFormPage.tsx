import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import FormField, { inputClass } from '../components/FormField'
import { useGeolocation } from '../hooks/useGeolocation'
import { useSurveyDetail } from '../hooks/useSurveys'
import { locationService } from '../services/locationService'
import type { LocationOption } from '../services/locationService'
import { parcelService } from '../services/parcelService'
import type { ParcelOption } from '../services/parcelService'
import { surveyService } from '../services/surveyService'
import type { SurveyInput } from '../types/survey'

type TargetMode = 'lokasi' | 'bidang'

interface FormState {
  targetMode: TargetMode
  lokasiId: string
  bidangId: string
  tanggal: string
  surveyor: string
  hasil: string
  catatan: string
  latitude: string
  longitude: string
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function SurveyFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const { survey, isLoading, error } = useSurveyDetail(id)
  const geolocation = useGeolocation()
  const [lokasiOptions, setLokasiOptions] = useState<LocationOption[]>([])
  const [bidangOptions, setBidangOptions] = useState<ParcelOption[]>([])
  const [form, setForm] = useState<FormState>(() => ({
    targetMode: searchParams.get('bidang') ? 'bidang' : 'lokasi',
    lokasiId: searchParams.get('lokasi') ?? '',
    bidangId: searchParams.get('bidang') ?? '',
    tanggal: todayIso(),
    surveyor: '',
    hasil: '',
    catatan: '',
    latitude: '',
    longitude: '',
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
      .catch(() => {
        // Dropdown target wajib; error tampil saat submit bila kosong.
      })
    parcelService
      .listOptions()
      .then((options) => {
        if (active) setBidangOptions(options)
      })
      .catch(() => {
        // Sama seperti di atas.
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (survey) {
      setForm({
        targetMode: survey.bidang_id ? 'bidang' : 'lokasi',
        lokasiId: survey.lokasi_id ?? '',
        bidangId: survey.bidang_id ?? '',
        tanggal: survey.tanggal_survey,
        surveyor: survey.surveyor,
        hasil: survey.hasil_survey,
        catatan: survey.catatan ?? '',
        latitude: survey.latitude === null ? '' : String(survey.latitude),
        longitude: survey.longitude === null ? '' : String(survey.longitude),
      })
    }
  }, [survey])

  // Tombol "Gunakan Lokasi Saya" (§17.8) — hanya dari klik user; hasil GPS
  // mengisi latitude & longitude secara berpasangan.
  useEffect(() => {
    if (geolocation.position) {
      setForm((prev) => ({
        ...prev,
        latitude: String(geolocation.position!.lat),
        longitude: String(geolocation.position!.lng),
      }))
    }
  }, [geolocation.position])

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setIsSubmitting(true)
    try {
      const lokasiId = form.targetMode === 'lokasi' ? form.lokasiId : ''
      const bidangId = form.targetMode === 'bidang' ? form.bidangId : ''
      if (!lokasiId && !bidangId) {
        setFormError('Pilih lokasi atau bidang sebagai target survey.')
        setIsSubmitting(false)
        return
      }
      const latRaw = form.latitude.trim().replace(',', '.')
      const lngRaw = form.longitude.trim().replace(',', '.')
      if ((latRaw === '') !== (lngRaw === '')) {
        setFormError('Latitude dan longitude harus diisi (atau dikosongkan) berpasangan.')
        setIsSubmitting(false)
        return
      }
      const input: SurveyInput = {
        lokasi_id: lokasiId || null,
        bidang_id: bidangId || null,
        tanggal_survey: form.tanggal,
        surveyor: form.surveyor,
        hasil_survey: form.hasil,
        catatan: form.catatan.trim() || null,
        latitude: latRaw === '' ? null : Number(latRaw),
        longitude: lngRaw === '' ? null : Number(lngRaw),
      }
      if (id) {
        await surveyService.update(id, input)
        navigate(`/survey/${id}`)
      } else {
        const saved = await surveyService.create(input)
        navigate(`/survey/${saved.id}`)
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan survey.')
      setIsSubmitting(false)
    }
  }

  if (id && isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 p-16 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
        Memuat survey…
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
          to="/survey"
          className="inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali ke daftar survey
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to={id ? `/survey/${id}` : '/survey'}
          className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {isEdit ? 'Ubah Survey' : 'Tambah Survey'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isEdit ? 'Perbarui data survey.' : 'Catat hasil survey lokasi atau bidang.'}
        </p>
      </div>

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Target Survey<span className="text-red-500"> *</span>
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
                    {option.lokasi ? ` — ${option.lokasi.nama}` : ''}
                  </option>
                ))}
              </select>
              {bidangOptions.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  Belum ada bidang. Buat bidang terlebih dahulu di menu Bidang Tanah.
                </p>
              )}
            </div>
          )}

          <FormField
            label="Tanggal Survey"
            value={form.tanggal}
            onChange={(value) => setField('tanggal', value)}
            type="date"
            required
          />
          <FormField
            label="Surveyor"
            value={form.surveyor}
            onChange={(value) => setField('surveyor', value)}
            required
            placeholder="Nama surveyor"
          />

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Hasil Survey<span className="text-red-500"> *</span>
            </label>
            <textarea
              value={form.hasil}
              onChange={(event) => setField('hasil', event.target.value)}
              rows={4}
              required
              placeholder="Ringkasan hasil survey: peruntukan, kondisi lahan, akses, lingkungan…"
              className={inputClass}
            />
          </div>

          <FormField
            label="Latitude"
            value={form.latitude}
            onChange={(value) => setField('latitude', value)}
            placeholder="-6.200000 (opsional)"
          />
          <FormField
            label="Longitude"
            value={form.longitude}
            onChange={(value) => setField('longitude', value)}
            placeholder="106.800000 (opsional)"
          />

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={() => geolocation.requestPosition()}
              disabled={geolocation.isLoading}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {geolocation.isLoading ? 'Mencari posisi…' : 'Gunakan Lokasi Saya'}
            </button>
            {(geolocation.error || geolocation.position) && (
              <p className={`mt-1 text-xs ${geolocation.error ? 'text-red-600' : 'text-slate-500'}`}>
                {geolocation.error ??
                  `Posisi terpasang: ${geolocation.position!.lat.toFixed(6)}, ${geolocation.position!.lng.toFixed(6)}`}
              </p>
            )}
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
            to={id ? `/survey/${id}` : '/survey'}
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
