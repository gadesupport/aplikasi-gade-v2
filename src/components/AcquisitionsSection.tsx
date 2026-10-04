import { useState } from 'react'
import AcquisitionStatusBadge from './AcquisitionStatusBadge'
import FormField, { inputClass } from './FormField'
import { useAcquisitionsByParcel } from '../hooks/useAcquisitions'
import { formatDate, formatLuas, formatRupiah } from '../lib/format'
import { parseNonNegativeDecimal } from '../lib/parse'
import { acquisitionService } from '../services/acquisitionService'
import { ACQUISITION_STATUSES, ACQUISITION_STATUS_LABELS } from '../types/acquisition'
import type { AcquisitionStatus, AcquisitionWithParcel } from '../types/acquisition'

interface ActiveForm {
  row: AcquisitionWithParcel | null
  tanggalMulai: string
  status: AcquisitionStatus
  hargaPenawaran: string
  hargaKesepakatan: string
  luasDibebaskan: string
  uangMuka: string
  pelunasan: string
  tanggalPelunasan: string
  pihakTerlibat: string
  catatan: string
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// Section "Pembebasan" pada halaman detail bidang (§10): daftar catatan
// pembebasan (negosiasi → transaksi → selesai/batal) dengan form inline
// tambah/ubah/hapus.
export default function AcquisitionsSection({ parcelId }: { parcelId: string }) {
  const { acquisitions, isLoading, error, reload } = useAcquisitionsByParcel(parcelId)
  const [activeForm, setActiveForm] = useState<ActiveForm | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function openAddForm() {
    setActionError(null)
    setActiveForm({
      row: null,
      tanggalMulai: todayIso(),
      status: 'NEGOSIASI',
      hargaPenawaran: '',
      hargaKesepakatan: '',
      luasDibebaskan: '',
      uangMuka: '',
      pelunasan: '',
      tanggalPelunasan: '',
      pihakTerlibat: '',
      catatan: '',
    })
  }

  function openEditForm(row: AcquisitionWithParcel) {
    setActionError(null)
    setActiveForm({
      row,
      tanggalMulai: row.tanggal_mulai,
      status: row.status_transaksi,
      hargaPenawaran: row.harga_penawaran === null ? '' : String(row.harga_penawaran),
      hargaKesepakatan: row.harga_kesepakatan === null ? '' : String(row.harga_kesepakatan),
      luasDibebaskan: row.luas_dibebaskan === null ? '' : String(row.luas_dibebaskan),
      uangMuka: row.uang_muka === null ? '' : String(row.uang_muka),
      pelunasan: row.pelunasan === null ? '' : String(row.pelunasan),
      tanggalPelunasan: row.tanggal_pelunasan ?? '',
      pihakTerlibat: row.pihak_terlibat ?? '',
      catatan: row.catatan ?? '',
    })
  }

  async function handleSave() {
    if (!activeForm) return
    setIsSaving(true)
    setActionError(null)
    try {
      const detail = {
        tanggal_mulai: activeForm.tanggalMulai,
        status_transaksi: activeForm.status,
        harga_penawaran: parseNonNegativeDecimal('Harga penawaran', activeForm.hargaPenawaran),
        harga_kesepakatan: parseNonNegativeDecimal(
          'Harga kesepakatan',
          activeForm.hargaKesepakatan,
        ),
        luas_dibebaskan: parseNonNegativeDecimal('Luas dibebaskan', activeForm.luasDibebaskan),
        uang_muka: parseNonNegativeDecimal('Uang muka', activeForm.uangMuka),
        pelunasan: parseNonNegativeDecimal('Pelunasan', activeForm.pelunasan),
        tanggal_pelunasan: activeForm.tanggalPelunasan || null,
        pihak_terlibat: activeForm.pihakTerlibat.trim() || null,
        catatan: activeForm.catatan.trim() || null,
      }
      if (activeForm.row) {
        await acquisitionService.update(activeForm.row.id, detail)
      } else {
        await acquisitionService.create({ bidang_id: parcelId, ...detail })
      }
      setActiveForm(null)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menyimpan pembebasan.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(row: AcquisitionWithParcel) {
    const confirmed = window.confirm(
      `Hapus catatan pembebasan ${formatDate(row.tanggal_mulai)} (${ACQUISITION_STATUS_LABELS[row.status_transaksi]})?`,
    )
    if (!confirmed) return
    setDeletingId(row.id)
    setActionError(null)
    try {
      await acquisitionService.remove(row.id)
      if (activeForm?.row?.id === row.id) setActiveForm(null)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menghapus pembebasan.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">
          Pembebasan ({acquisitions.length})
        </h2>
        {!activeForm && (
          <button
            type="button"
            onClick={openAddForm}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            + Tambah Catatan
          </button>
        )}
      </div>

      {actionError && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {activeForm && (
        <div className="mx-6 mt-4 space-y-4 rounded-lg border border-emerald-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-700">
            {activeForm.row ? 'Ubah' : 'Tambah'} Catatan Pembebasan
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Tanggal Mulai"
              value={activeForm.tanggalMulai}
              onChange={(value) => setActiveForm({ ...activeForm, tanggalMulai: value })}
              type="date"
              required
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Status Transaksi
              </label>
              <select
                value={activeForm.status}
                onChange={(event) =>
                  setActiveForm({
                    ...activeForm,
                    status: event.target.value as AcquisitionStatus,
                  })
                }
                className={inputClass}
              >
                {ACQUISITION_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {ACQUISITION_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <FormField
              label="Harga Penawaran (Rp)"
              value={activeForm.hargaPenawaran}
              onChange={(value) => setActiveForm({ ...activeForm, hargaPenawaran: value })}
              type="number"
              step="any"
              min="0"
            />
            <FormField
              label="Harga Kesepakatan (Rp)"
              value={activeForm.hargaKesepakatan}
              onChange={(value) => setActiveForm({ ...activeForm, hargaKesepakatan: value })}
              type="number"
              step="any"
              min="0"
            />
            <FormField
              label="Luas Dibebaskan (m²)"
              value={activeForm.luasDibebaskan}
              onChange={(value) => setActiveForm({ ...activeForm, luasDibebaskan: value })}
              type="number"
              step="any"
              min="0"
            />
            <FormField
              label="Uang Muka (Rp)"
              value={activeForm.uangMuka}
              onChange={(value) => setActiveForm({ ...activeForm, uangMuka: value })}
              type="number"
              step="any"
              min="0"
            />
            <FormField
              label="Pelunasan (Rp)"
              value={activeForm.pelunasan}
              onChange={(value) => setActiveForm({ ...activeForm, pelunasan: value })}
              type="number"
              step="any"
              min="0"
            />
            <FormField
              label="Tanggal Pelunasan"
              value={activeForm.tanggalPelunasan}
              onChange={(value) => setActiveForm({ ...activeForm, tanggalPelunasan: value })}
              type="date"
            />
            <FormField
              label="Pihak Terlibat"
              value={activeForm.pihakTerlibat}
              onChange={(value) => setActiveForm({ ...activeForm, pihakTerlibat: value })}
              full
              placeholder="Nama-nama pihak yang terlibat"
            />
            <FormField
              label="Catatan"
              value={activeForm.catatan}
              onChange={(value) => setActiveForm({ ...activeForm, catatan: value })}
              textarea
              full
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setActiveForm(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
      )}

      {error ? (
        <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-3 p-10 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
          Memuat pembebasan…
        </div>
      ) : acquisitions.length === 0 && !activeForm ? (
        <div className="p-10 text-center">
          <p className="text-sm font-medium text-slate-700">Belum ada catatan pembebasan.</p>
          <p className="mt-1 text-sm text-slate-500">
            Tambahkan catatan untuk memulai proses negosiasi bidang ini.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {acquisitions.map((row) => (
            <li key={row.id} className="px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      Mulai {formatDate(row.tanggal_mulai)}
                    </span>
                    <AcquisitionStatusBadge status={row.status_transaksi} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Penawaran {formatRupiah(row.harga_penawaran)} · Kesepakatan{' '}
                    {formatRupiah(row.harga_kesepakatan)} · Luas {formatLuas(row.luas_dibebaskan)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Uang muka {formatRupiah(row.uang_muka)} · Pelunasan{' '}
                    {formatRupiah(row.pelunasan)}
                    {row.tanggal_pelunasan ? ` (${formatDate(row.tanggal_pelunasan)})` : ''}
                    {row.pihak_terlibat ? ` · ${row.pihak_terlibat}` : ''}
                  </p>
                  {row.catatan && (
                    <p className="mt-0.5 whitespace-pre-line text-xs text-slate-400">
                      {row.catatan}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openEditForm(row)}
                    className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    Ubah
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(row)}
                    disabled={deletingId === row.id}
                    className="text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingId === row.id ? 'Menghapus…' : 'Hapus'}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
