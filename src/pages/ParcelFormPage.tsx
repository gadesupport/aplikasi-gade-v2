import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import FormField, { inputClass } from '../components/FormField'
import { useParcelDetail } from '../hooks/useParcels'
import { ServiceError } from '../lib/errors'
import { parseNonNegativeDecimal } from '../lib/parse'
import { locationService } from '../services/locationService'
import type { LocationOption } from '../services/locationService'
import { parcelService } from '../services/parcelService'
import { JENIS_HAK_SUGGESTIONS, PARCEL_STATUSES, PARCEL_STATUS_LABELS } from '../types/parcel'
import type { ParcelInput, ParcelStatus } from '../types/parcel'

interface FormState {
  kode: string
  lokasiId: string
  nomorBidang: string
  luas: string
  jenisHak: string
  nomorHak: string
  status: ParcelStatus
  hargaPenawaran: string
  hargaKesepakatan: string
  tanggalKesepakatan: string
  catatan: string
}

export default function ParcelFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const { parcel, isLoading, error } = useParcelDetail(id)
  const [lokasiOptions, setLokasiOptions] = useState<LocationOption[]>([])
  const [form, setForm] = useState<FormState>(() => ({
    kode: '',
    lokasiId: searchParams.get('lokasi') ?? '',
    nomorBidang: '',
    luas: '',
    jenisHak: '',
    nomorHak: '',
    status: 'TERIDENTIFIKASI',
    hargaPenawaran: '',
    hargaKesepakatan: '',
    tanggalKesepakatan: '',
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
      .catch(() => {
        // Dropdown lokasi wajib untuk submit; form akan menampilkan error saat memilih.
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (parcel) {
      setForm({
        kode: parcel.kode,
        lokasiId: parcel.lokasi_id,
        nomorBidang: parcel.nomor_bidang ?? '',
        luas: parcel.luas === null ? '' : String(parcel.luas),
        jenisHak: parcel.jenis_hak ?? '',
        nomorHak: parcel.nomor_hak ?? '',
        status: parcel.status_pembebasan,
        hargaPenawaran: parcel.harga_penawaran === null ? '' : String(parcel.harga_penawaran),
        hargaKesepakatan:
          parcel.harga_kesepakatan === null ? '' : String(parcel.harga_kesepakatan),
        tanggalKesepakatan: parcel.tanggal_kesepakatan ?? '',
        catatan: parcel.catatan ?? '',
      })
    }
  }, [parcel])

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setIsSubmitting(true)
    try {
      if (!form.lokasiId) {
        throw new ServiceError('Lokasi induk wajib dipilih.')
      }
      const input: ParcelInput = {
        lokasi_id: form.lokasiId,
        kode: form.kode,
        nomor_bidang: form.nomorBidang.trim() || null,
        luas: parseNonNegativeDecimal('Luas', form.luas),
        jenis_hak: form.jenisHak.trim() || null,
        nomor_hak: form.nomorHak.trim() || null,
        status_pembebasan: form.status,
        harga_penawaran: parseNonNegativeDecimal('Harga penawaran', form.hargaPenawaran),
        harga_kesepakatan: parseNonNegativeDecimal('Harga kesepakatan', form.hargaKesepakatan),
        tanggal_kesepakatan: form.tanggalKesepakatan || null,
        catatan: form.catatan.trim() || null,
      }
      const saved = id ? await parcelService.update(id, input) : await parcelService.create(input)
      navigate(`/bidang/${saved.id}`)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan bidang tanah.')
      setIsSubmitting(false)
    }
  }

  if (id && isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 p-16 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
        Memuat bidang tanah…
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
          to="/bidang"
          className="inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali ke daftar bidang tanah
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to={id ? `/bidang/${id}` : '/bidang'}
          className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {isEdit ? 'Ubah Bidang Tanah' : 'Tambah Bidang Tanah'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isEdit ? 'Perbarui data bidang tanah.' : 'Isi data bidang tanah baru.'}
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
              Lokasi Induk<span className="text-red-500"> *</span>
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
            {lokasiOptions.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Belum ada lokasi. Buat lokasi terlebih dahulu di menu Lokasi.
              </p>
            )}
          </div>
          <FormField
            label="Kode"
            value={form.kode}
            onChange={(value) => setField('kode', value)}
            required
            placeholder="GDE-BDG-2026-001"
          />
          <FormField
            label="Nomor Bidang"
            value={form.nomorBidang}
            onChange={(value) => setField('nomorBidang', value)}
            placeholder="Nomor bidang"
          />
          <FormField
            label="Luas (m²)"
            value={form.luas}
            onChange={(value) => setField('luas', value)}
            type="number"
            step="any"
            min="0"
          />
          <FormField
            label="Jenis Hak"
            value={form.jenisHak}
            onChange={(value) => setField('jenisHak', value)}
            list="jenis-hak-suggestions"
            placeholder="SHM / SHGB / Girik…"
          />
          <datalist id="jenis-hak-suggestions">
            {JENIS_HAK_SUGGESTIONS.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
          <FormField
            label="Nomor Hak"
            value={form.nomorHak}
            onChange={(value) => setField('nomorHak', value)}
            placeholder="Nomor sertifikat/hak"
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Status Pembebasan
            </label>
            <select
              value={form.status}
              onChange={(event) => setField('status', event.target.value as ParcelStatus)}
              className={inputClass}
            >
              {PARCEL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PARCEL_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <FormField
            label="Harga Penawaran (Rp)"
            value={form.hargaPenawaran}
            onChange={(value) => setField('hargaPenawaran', value)}
            type="number"
            step="any"
            min="0"
          />
          <FormField
            label="Harga Kesepakatan (Rp)"
            value={form.hargaKesepakatan}
            onChange={(value) => setField('hargaKesepakatan', value)}
            type="number"
            step="any"
            min="0"
          />
          <FormField
            label="Tanggal Kesepakatan"
            value={form.tanggalKesepakatan}
            onChange={(value) => setField('tanggalKesepakatan', value)}
            type="date"
          />
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
            to={id ? `/bidang/${id}` : '/bidang'}
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
