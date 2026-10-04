import { useState } from 'react'
import HandoverTypeBadge from './HandoverTypeBadge'
import FormField from './FormField'
import { useHandoversByArchive } from '../hooks/useHandovers'
import { formatDate, formatDateTime } from '../lib/format'
import { downloadHandoverReceiptPdf, printHandoverReceiptPdf } from '../lib/handoverReceipt'
import { handoverService } from '../services/handoverService'
import { HANDOVER_TYPES, HANDOVER_TYPE_LABELS } from '../types/handover'
import type { HandoverRecord, HandoverType } from '../types/handover'

interface FormState {
  jenis: HandoverType
  tanggal: string
  dari: string
  kepada: string
  keperluan: string
  catatan: string
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// Section "Serah Terima" pada halaman detail arsip (§14): histori permanen
// + form pencatatan. Pencatatan lewat RPC create_handover yang ATOMIK —
// BERKAS_KELUAR mengubah arsip menjadi DIPINJAM, BERKAS_KEMBALI menjadi
// TERSEDIA (badge status di halaman ini ikut diperbarui via reload arsip).
export default function HandoversSection({
  archiveId,
  onArchiveStatusChanged,
}: {
  archiveId: string
  onArchiveStatusChanged: () => void
}) {
  const { handovers, isLoading, error, reload } = useHandoversByArchive(archiveId)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(() => ({
    jenis: 'BERKAS_KELUAR',
    tanggal: todayIso(),
    dari: '',
    kepada: '',
    keperluan: '',
    catatan: '',
  }))
  const [isSaving, setIsSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setIsSaving(true)
    setActionError(null)
    try {
      await handoverService.create({
        archiveId,
        jenis: form.jenis,
        tanggal: form.tanggal,
        dari: form.dari,
        kepada: form.kepada,
        keperluan: form.keperluan.trim() || null,
        catatan: form.catatan.trim() || null,
      })
      setForm((prev) => ({
        ...prev,
        dari: '',
        kepada: '',
        keperluan: '',
        catatan: '',
        jenis: prev.jenis === 'BERKAS_KELUAR' ? 'BERKAS_KEMBALI' : prev.jenis,
      }))
      setShowForm(false)
      reload()
      // Status arsip bisa berubah (KELUAR/KEMBALI) — muat ulang detail.
      onArchiveStatusChanged()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal mencatat serah terima.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDownloadReceipt(row: HandoverRecord) {
    setBusyId(row.id)
    setActionError(null)
    try {
      await downloadHandoverReceiptPdf(row)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal membuat PDF.')
    } finally {
      setBusyId(null)
    }
  }

  async function handlePrintReceipt(row: HandoverRecord) {
    setBusyId(row.id)
    setActionError(null)
    try {
      await printHandoverReceiptPdf(row)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal mencetak.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">
          Serah Terima ({handovers.length})
        </h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => {
              setActionError(null)
              setShowForm(true)
            }}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            + Catat Serah Terima
          </button>
        )}
      </div>

      {actionError && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {showForm && (
        <div className="mx-6 mt-4 space-y-4 rounded-lg border border-emerald-200 bg-slate-50 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Jenis<span className="text-red-500"> *</span>
            </label>
            <div className="flex flex-wrap gap-4">
              {HANDOVER_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="handover-type"
                    checked={form.jenis === type}
                    onChange={() => setField('jenis', type)}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  {HANDOVER_TYPE_LABELS[type]}
                  {type === 'BERKAS_KELUAR' && (
                    <span className="text-xs text-slate-400">(arsip → Dipinjam)</span>
                  )}
                  {type === 'BERKAS_KEMBALI' && (
                    <span className="text-xs text-slate-400">(arsip → Tersedia)</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Tanggal"
              value={form.tanggal}
              onChange={(value) => setField('tanggal', value)}
              type="date"
              required
            />
            <FormField
              label="Dari"
              value={form.dari}
              onChange={(value) => setField('dari', value)}
              required
              placeholder="Pihak penyerah/peminjam"
            />
            <FormField
              label="Kepada"
              value={form.kepada}
              onChange={(value) => setField('kepada', value)}
              required
              placeholder="Pihak penerima"
            />
            <FormField
              label="Keperluan"
              value={form.keperluan}
              onChange={(value) => setField('keperluan', value)}
              placeholder="Keperluan peminjaman/penyerahan"
            />
            <FormField
              label="Catatan"
              value={form.catatan}
              onChange={(value) => setField('catatan', value)}
              full
              textarea
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
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
          Memuat histori serah terima…
        </div>
      ) : handovers.length === 0 && !showForm ? (
        <div className="p-10 text-center">
          <p className="text-sm font-medium text-slate-700">Belum ada riwayat serah terima.</p>
          <p className="mt-1 text-sm text-slate-500">
            Catat berkas masuk, keluar, atau kembali untuk arsip ini.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {handovers.map((row) => (
            <li key={row.id} className="px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">{row.nomor}</span>
                    <HandoverTypeBadge type={row.jenis} />
                  </div>
                  <p className="mt-1 text-sm text-slate-900">
                    {formatDate(row.tanggal)} — {row.dari} → {row.kepada}
                  </p>
                  {row.keperluan && (
                    <p className="text-xs text-slate-500">Keperluan: {row.keperluan}</p>
                  )}
                  {row.catatan && <p className="text-xs text-slate-400">{row.catatan}</p>}
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {formatDateTime(row.created_at)}
                </span>
              </div>
              <div className="mt-2 flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleDownloadReceipt(row)}
                  disabled={busyId === row.id}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyId === row.id ? 'Memproses…' : 'PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => void handlePrintReceipt(row)}
                  disabled={busyId === row.id}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cetak
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-slate-100 px-6 py-3 text-xs text-slate-400">
        Histori bersifat permanen — catatan tidak dapat diedit atau dihapus dari aplikasi.
      </p>
    </div>
  )
}
