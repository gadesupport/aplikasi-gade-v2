import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import FormField, { inputClass } from '../components/FormField'
import { usePartyDetail } from '../hooks/useParties'
import { partyService } from '../services/partyService'
import { PARTY_TYPES, PARTY_TYPE_LABELS } from '../types/party'
import type { PartyInput, PartyType } from '../types/party'

interface FormState {
  nama: string
  nik: string
  alamat: string
  nomorTelepon: string
  tipe: PartyType
  catatan: string
}

const EMPTY_FORM: FormState = {
  nama: '',
  nik: '',
  alamat: '',
  nomorTelepon: '',
  tipe: 'PEMEGANG_HAK',
  catatan: '',
}

export default function PartyFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const { party, isLoading, error } = usePartyDetail(id)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (party) {
      setForm({
        nama: party.nama,
        nik: party.nik ?? '',
        alamat: party.alamat ?? '',
        nomorTelepon: party.nomor_telepon ?? '',
        tipe: party.tipe_pihak,
        catatan: party.catatan ?? '',
      })
    }
  }, [party])

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }) as FormState)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setIsSubmitting(true)
    try {
      const input: PartyInput = {
        nama: form.nama,
        nik: form.nik.trim() || null,
        alamat: form.alamat.trim() || null,
        nomor_telepon: form.nomorTelepon.trim() || null,
        tipe_pihak: form.tipe,
        catatan: form.catatan.trim() || null,
      }
      if (id) {
        await partyService.update(id, input)
      } else {
        await partyService.create(input)
      }
      navigate('/pihak')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan pihak.')
      setIsSubmitting(false)
    }
  }

  if (id && isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 p-16 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
        Memuat pihak…
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
          to="/pihak"
          className="inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali ke daftar pihak
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to="/pihak"
          className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          ← Kembali
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {isEdit ? 'Ubah Pihak' : 'Tambah Pihak'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isEdit ? 'Perbarui data pihak/pemilik.' : 'Isi data pihak/pemilik baru.'}
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
            label="Nama"
            value={form.nama}
            onChange={(value) => setField('nama', value)}
            required
            placeholder="Nama lengkap pihak"
          />
          <FormField
            label="NIK"
            value={form.nik}
            onChange={(value) => setField('nik', value)}
            placeholder="16 digit NIK (opsional)"
          />
          <FormField
            label="Nomor Telepon"
            value={form.nomorTelepon}
            onChange={(value) => setField('nomorTelepon', value)}
            placeholder="Nomor telepon (opsional)"
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tipe Pihak</label>
            <select
              value={form.tipe}
              onChange={(event) => setField('tipe', event.target.value)}
              className={inputClass}
            >
              {PARTY_TYPES.map((tipe) => (
                <option key={tipe} value={tipe}>
                  {PARTY_TYPE_LABELS[tipe]}
                </option>
              ))}
            </select>
          </div>
          <FormField
            label="Alamat"
            value={form.alamat}
            onChange={(value) => setField('alamat', value)}
            full
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
            to="/pihak"
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
