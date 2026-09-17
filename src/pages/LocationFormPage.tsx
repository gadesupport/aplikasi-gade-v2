import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import FormField, { inputClass } from '../components/FormField'
import { useLocationDetail } from '../hooks/useLocations'
import { parseNonNegativeDecimal } from '../lib/parse'
import { locationService } from '../services/locationService'
import { LOCATION_STATUSES, LOCATION_STATUS_LABELS } from '../types/location'
import type { LocationInput, LocationStatus } from '../types/location'

interface FormState {
  kode: string
  nama: string
  alamat: string
  desa: string
  kecamatan: string
  kabupaten: string
  luasTarget: string
  luasTeridentifikasi: string
  luasDeal: string
  peruntukan: string
  kondisiLahan: string
  kondisiPasar: string
  catatan: string
  status: LocationStatus
}

const EMPTY_FORM: FormState = {
  kode: '',
  nama: '',
  alamat: '',
  desa: '',
  kecamatan: '',
  kabupaten: '',
  luasTarget: '',
  luasTeridentifikasi: '',
  luasDeal: '',
  peruntukan: '',
  kondisiLahan: '',
  kondisiPasar: '',
  catatan: '',
  status: 'SURVEY',
}

export default function LocationFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const { location, isLoading, error } = useLocationDetail(id)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (location) {
      setForm({
        kode: location.kode,
        nama: location.nama,
        alamat: location.alamat ?? '',
        desa: location.desa ?? '',
        kecamatan: location.kecamatan ?? '',
        kabupaten: location.kabupaten ?? '',
        luasTarget: location.luas_target === null ? '' : String(location.luas_target),
        luasTeridentifikasi:
          location.luas_teridentifikasi === null ? '' : String(location.luas_teridentifikasi),
        luasDeal: location.luas_deal === null ? '' : String(location.luas_deal),
        peruntukan: location.peruntukan ?? '',
        kondisiLahan: location.kondisi_lahan ?? '',
        kondisiPasar: location.kondisi_pasar ?? '',
        catatan: location.catatan ?? '',
        status: location.status,
      })
    }
  }, [location])

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }) as FormState)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setIsSubmitting(true)
    try {
      const input: LocationInput = {
        kode: form.kode,
        nama: form.nama,
        alamat: form.alamat.trim() || null,
        desa: form.desa.trim() || null,
        kecamatan: form.kecamatan.trim() || null,
        kabupaten: form.kabupaten.trim() || null,
        luas_target: parseNonNegativeDecimal('Luas target', form.luasTarget),
        luas_teridentifikasi: parseNonNegativeDecimal(
          'Luas teridentifikasi',
          form.luasTeridentifikasi,
        ),
        luas_deal: parseNonNegativeDecimal('Luas deal', form.luasDeal),
        peruntukan: form.peruntukan.trim() || null,
        kondisi_lahan: form.kondisiLahan.trim() || null,
        kondisi_pasar: form.kondisiPasar.trim() || null,
        catatan: form.catatan.trim() || null,
        status: form.status,
      }
      const saved = id
        ? await locationService.update(id, input)
        : await locationService.create(input)
      navigate(`/lokasi/${saved.id}`)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan lokasi.')
      setIsSubmitting(false)
    }
  }

  if (id && isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 p-16 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
        Memuat lokasi…
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
          to="/lokasi"
          className="inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali ke daftar lokasi
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to={id ? `/lokasi/${id}` : '/lokasi'}
          className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {isEdit ? 'Ubah Lokasi' : 'Tambah Lokasi'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isEdit ? 'Perbarui data lokasi/areal.' : 'Isi data lokasi/areal baru.'}
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
            placeholder="GDE-LOC-2026-001"
          />
          <FormField
            label="Nama"
            value={form.nama}
            onChange={(value) => setField('nama', value)}
            required
            placeholder="Nama lokasi/areal"
          />
          <FormField label="Alamat" value={form.alamat} onChange={(value) => setField('alamat', value)} full />
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
          <FormField
            label="Peruntukan"
            value={form.peruntukan}
            onChange={(value) => setField('peruntukan', value)}
          />
          <FormField
            label="Kondisi Lahan"
            value={form.kondisiLahan}
            onChange={(value) => setField('kondisiLahan', value)}
          />
          <FormField
            label="Kondisi Pasar"
            value={form.kondisiPasar}
            onChange={(value) => setField('kondisiPasar', value)}
          />
          <FormField
            label="Luas Target (m²)"
            value={form.luasTarget}
            onChange={(value) => setField('luasTarget', value)}
            type="number"
            step="any"
            min="0"
          />
          <FormField
            label="Luas Teridentifikasi (m²)"
            value={form.luasTeridentifikasi}
            onChange={(value) => setField('luasTeridentifikasi', value)}
            type="number"
            step="any"
            min="0"
          />
          <FormField
            label="Luas Deal (m²)"
            value={form.luasDeal}
            onChange={(value) => setField('luasDeal', value)}
            type="number"
            step="any"
            min="0"
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
            <select
              value={form.status}
              onChange={(event) => setField('status', event.target.value)}
              className={inputClass}
            >
              {LOCATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {LOCATION_STATUS_LABELS[status]}
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
            to={id ? `/lokasi/${id}` : '/lokasi'}
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
