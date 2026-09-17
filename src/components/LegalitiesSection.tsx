import { useEffect, useMemo, useState } from 'react'
import LegalityStatusBadge from './LegalityStatusBadge'
import { inputClass } from './FormField'
import { useParcelLegalities } from '../hooks/useLegalities'
import { formatDate } from '../lib/format'
import { summarizeLegalityChecklist } from '../lib/legality'
import { legalityService } from '../services/legalityService'
import { partyService } from '../services/partyService'
import type { PartyRef } from '../types/party'
import {
  LEGALITY_DOC_TYPE_LABELS,
  LEGALITY_STATUSES,
  LEGALITY_STATUS_LABELS,
} from '../types/legality'
import type { LegalityDocType, LegalityRecord, LegalityStatus } from '../types/legality'

interface ActiveForm {
  jenis: LegalityDocType
  row: LegalityRecord | null
  status: LegalityStatus
  nomor: string
  tanggal: string
  penerbit: string
  pihakId: string
  catatan: string
}

// Section "Checklist Legalitas" pada halaman detail bidang: daftar jenis
// dokumen standar dengan status teragregasi, persentase kelengkapan, dan
// form inline untuk tambah/ubah/hapus baris legalitas.
export default function LegalitiesSection({ parcelId }: { parcelId: string }) {
  const { rows, isLoading, error, reload } = useParcelLegalities(parcelId)
  const [partyOptions, setPartyOptions] = useState<PartyRef[]>([])
  const [activeForm, setActiveForm] = useState<ActiveForm | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    partyService
      .listOptions()
      .then((options) => {
        if (active) setPartyOptions(options)
      })
      .catch(() => {
        // Dropdown pihak opsional — biarkan kosong bila gagal dimuat.
      })
    return () => {
      active = false
    }
  }, [])

  const checklist = useMemo(() => summarizeLegalityChecklist(rows), [rows])
  const denominator = checklist.total - checklist.tidakRelevanCount

  function openAddForm(jenis: LegalityDocType) {
    setActionError(null)
    setActiveForm({
      jenis,
      row: null,
      status: 'ADA',
      nomor: '',
      tanggal: '',
      penerbit: '',
      pihakId: '',
      catatan: '',
    })
  }

  function openEditForm(row: LegalityRecord) {
    setActionError(null)
    setActiveForm({
      jenis: row.jenis_dokumen,
      row,
      status: row.status,
      nomor: row.nomor_dokumen ?? '',
      tanggal: row.tanggal_dokumen ?? '',
      penerbit: row.penerbit ?? '',
      pihakId: row.pihak_id ?? '',
      catatan: row.catatan ?? '',
    })
  }

  async function handleSave() {
    if (!activeForm) return
    setIsSaving(true)
    setActionError(null)
    try {
      const detail = {
        nomor_dokumen: activeForm.nomor.trim() || null,
        tanggal_dokumen: activeForm.tanggal || null,
        penerbit: activeForm.penerbit.trim() || null,
        status: activeForm.status,
        pihak_id: activeForm.pihakId || null,
        catatan: activeForm.catatan.trim() || null,
      }
      if (activeForm.row) {
        await legalityService.update(activeForm.row.id, detail)
      } else {
        await legalityService.create({
          bidang_id: parcelId,
          jenis_dokumen: activeForm.jenis,
          ...detail,
        })
      }
      setActiveForm(null)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menyimpan legalitas.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(row: LegalityRecord) {
    const confirmed = window.confirm(
      `Hapus data legalitas ${LEGALITY_DOC_TYPE_LABELS[row.jenis_dokumen]}${row.nomor_dokumen ? ` (${row.nomor_dokumen})` : ''}?`,
    )
    if (!confirmed) return
    setDeletingId(row.id)
    setActionError(null)
    try {
      await legalityService.remove(row.id)
      if (activeForm?.row?.id === row.id) setActiveForm(null)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menghapus legalitas.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Checklist Legalitas</h2>
          <span className="text-sm font-semibold text-emerald-600">
            {checklist.percentage}% lengkap
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${checklist.percentage}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {checklist.adaCount} dari {denominator} jenis dokumen berstatus Ada.{' '}
          {checklist.tidakRelevanCount > 0 &&
            `${checklist.tidakRelevanCount} jenis ditandai Tidak Relevan dan dikecualikan. `}
          Persentase = Ada ÷ ({checklist.total} jenis − Tidak Relevan).
        </p>
      </div>

      {actionError && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {error ? (
        <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-3 p-10 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
          Memuat legalitas…
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {checklist.items.map((item) => (
            <li key={item.jenis} className="px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">
                    {LEGALITY_DOC_TYPE_LABELS[item.jenis]}
                  </span>
                  <LegalityStatusBadge status={item.status} />
                </div>
                <button
                  type="button"
                  onClick={() => openAddForm(item.jenis)}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                >
                  + Tambah
                </button>
              </div>

              {item.rows.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {item.rows.map((row) => (
                    <li key={row.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 text-sm">
                          <p className="text-slate-900">{row.nomor_dokumen || '(tanpa nomor)'}</p>
                          <p className="text-xs text-slate-500">
                            {[formatDate(row.tanggal_dokumen), row.penerbit, row.pihak?.nama]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </p>
                          {row.catatan && <p className="text-xs text-slate-400">{row.catatan}</p>}
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
            </li>
          ))}
        </ul>
      )}

      {activeForm && (
        <div className="mx-6 mb-6 mt-4 space-y-4 rounded-lg border border-emerald-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-700">
            {activeForm.row ? 'Ubah' : 'Tambah'} — {LEGALITY_DOC_TYPE_LABELS[activeForm.jenis]}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
              <select
                value={activeForm.status}
                onChange={(event) =>
                  setActiveForm((prev) =>
                    prev ? { ...prev, status: event.target.value as LegalityStatus } : prev,
                  )
                }
                className={inputClass}
              >
                {LEGALITY_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {LEGALITY_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Nomor Dokumen</label>
              <input
                type="text"
                value={activeForm.nomor}
                onChange={(event) =>
                  setActiveForm((prev) => (prev ? { ...prev, nomor: event.target.value } : prev))
                }
                placeholder="Nomor dokumen"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Tanggal Dokumen
              </label>
              <input
                type="date"
                value={activeForm.tanggal}
                onChange={(event) =>
                  setActiveForm((prev) => (prev ? { ...prev, tanggal: event.target.value } : prev))
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Penerbit</label>
              <input
                type="text"
                value={activeForm.penerbit}
                onChange={(event) =>
                  setActiveForm((prev) => (prev ? { ...prev, penerbit: event.target.value } : prev))
                }
                placeholder="Instansi/penerbit dokumen"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Pihak Terkait (opsional)
              </label>
              <select
                value={activeForm.pihakId}
                onChange={(event) =>
                  setActiveForm((prev) => (prev ? { ...prev, pihakId: event.target.value } : prev))
                }
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
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Catatan</label>
              <textarea
                value={activeForm.catatan}
                onChange={(event) =>
                  setActiveForm((prev) => (prev ? { ...prev, catatan: event.target.value } : prev))
                }
                rows={2}
                placeholder="Catatan (opsional)"
                className={inputClass}
              />
            </div>
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
    </div>
  )
}
