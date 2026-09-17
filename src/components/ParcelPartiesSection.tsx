import { useState } from 'react'
import PartyTypeBadge from './PartyTypeBadge'
import { inputClass } from './FormField'
import { useParcelParties, useParties } from '../hooks/useParties'
import { partyService } from '../services/partyService'
import { PERAN_SUGGESTIONS } from '../types/party'
import type { ParcelPartyWithParty, PartyRef } from '../types/party'

interface EditingState {
  id: string
  peran: string
  keterangan: string
}

// Section "Pihak Terkait" pada halaman detail bidang:
// daftar relasi, tambah pihak (dengan pencarian), edit peran/keterangan,
// dan hapus relasi. Data master pihak dikelola di menu Pihak/Pemilik.
export default function ParcelPartiesSection({ parcelId }: { parcelId: string }) {
  const { relations, isLoading, error, reload } = useParcelParties(parcelId)
  const [isAdding, setIsAdding] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [selectedParty, setSelectedParty] = useState<PartyRef | null>(null)
  const [peran, setPeran] = useState('')
  const [keterangan, setKeterangan] = useState('')
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const picker = useParties({ search: pickerSearch, tipe: null, page: 1, pageSize: 8 })
  // Sembunyikan pihak yang sudah terhubung dari hasil pencarian.
  const linkedPartyIds = new Set(relations.map((relation) => relation.party_id))
  const pickerResults = picker.result.data.filter((party) => !linkedPartyIds.has(party.id))

  function resetAddForm() {
    setPickerSearch('')
    setSelectedParty(null)
    setPeran('')
    setKeterangan('')
    setActionError(null)
  }

  async function handleAdd() {
    if (!selectedParty) {
      setActionError('Pilih pihak terlebih dahulu.')
      return
    }
    setIsSaving(true)
    setActionError(null)
    try {
      await partyService.addPartyToParcel({
        parcel_id: parcelId,
        party_id: selectedParty.id,
        peran: peran.trim() || null,
        keterangan: keterangan.trim() || null,
      })
      resetAddForm()
      setIsAdding(false)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menghubungkan pihak.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveEdit() {
    if (!editing) return
    setIsSaving(true)
    setActionError(null)
    try {
      await partyService.updateParcelParty(editing.id, {
        peran: editing.peran.trim() || null,
        keterangan: editing.keterangan.trim() || null,
      })
      setEditing(null)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menyimpan perubahan.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemoveRelation(relation: ParcelPartyWithParty) {
    const nama = relation.party?.nama ?? 'ini'
    const confirmed = window.confirm(
      `Hapus relasi pihak "${nama}" dari bidang ini?\nData master pihak tetap tersimpan.`,
    )
    if (!confirmed) return
    setActionError(null)
    try {
      await partyService.removeParcelParty(relation.id)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menghapus relasi.')
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">
          Pihak Terkait ({relations.length})
        </h2>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            + Tambah Pihak ke Bidang
          </button>
        )}
      </div>

      {actionError && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {isAdding && (
        <div className="mx-6 mt-4 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              Cari pihak<span className="text-red-500"> *</span>
            </p>
            {selectedParty ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-white px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-slate-900">{selectedParty.nama}</span>
                  {selectedParty.nik && (
                    <span className="font-mono text-xs text-slate-500">{selectedParty.nik}</span>
                  )}
                  <PartyTypeBadge type={selectedParty.tipe_pihak} />
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedParty(null)}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                >
                  Ganti
                </button>
              </div>
            ) : (
              <>
                <input
                  type="search"
                  value={pickerSearch}
                  onChange={(event) => setPickerSearch(event.target.value)}
                  placeholder="Cari nama, NIK, atau telepon…"
                  className={inputClass}
                />
                <div className="mt-2 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                  {picker.isLoading ? (
                    <p className="px-3 py-2 text-sm text-slate-500">Mencari…</p>
                  ) : picker.error ? (
                    <p className="px-3 py-2 text-sm text-red-600">{picker.error}</p>
                  ) : pickerResults.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-500">
                      Tidak ada pihak ditemukan. Tambahkan pihak baru lewat menu Pihak/Pemilik.
                    </p>
                  ) : (
                    pickerResults.map((party) => (
                      <button
                        key={party.id}
                        type="button"
                        onClick={() => setSelectedParty(party)}
                        className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <span className="text-sm font-medium text-slate-900">{party.nama}</span>
                        {party.nik && (
                          <span className="font-mono text-xs text-slate-500">{party.nik}</span>
                        )}
                        <PartyTypeBadge type={party.tipe_pihak} />
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Peran</label>
              <input
                type="text"
                value={peran}
                onChange={(event) => setPeran(event.target.value)}
                list="peran-suggestions"
                placeholder="Pemilik / Ahli Waris / Kuasa Jual…"
                className={inputClass}
              />
              <datalist id="peran-suggestions">
                {PERAN_SUGGESTIONS.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Keterangan</label>
              <input
                type="text"
                value={keterangan}
                onChange={(event) => setKeterangan(event.target.value)}
                placeholder="Keterangan relasi (opsional)"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false)
                resetAddForm()
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={isSaving || !selectedParty}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Menyimpan…' : 'Hubungkan'}
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
          Memuat pihak terkait…
        </div>
      ) : relations.length === 0 && !isAdding ? (
        <div className="p-10 text-center">
          <p className="text-sm font-medium text-slate-700">Belum ada pihak terhubung.</p>
          <p className="mt-1 text-sm text-slate-500">
            Hubungkan pihak/pemilik ke bidang ini untuk mencatat kepemilikan.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {relations.map((relation) => (
            <li key={relation.id} className="px-6 py-4">
              {editing?.id === relation.id ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-900">
                    {relation.party?.nama ?? 'Pihak'}
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      value={editing.peran}
                      onChange={(event) =>
                        setEditing({ ...editing, peran: event.target.value })
                      }
                      list="peran-suggestions"
                      placeholder="Peran"
                      className={inputClass}
                    />
                    <input
                      type="text"
                      value={editing.keterangan}
                      onChange={(event) =>
                        setEditing({ ...editing, keterangan: event.target.value })
                      }
                      placeholder="Keterangan"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveEdit()}
                      disabled={isSaving}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? 'Menyimpan…' : 'Simpan'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {relation.party?.nama ?? 'Pihak tidak diketahui'}
                      </span>
                      {relation.party && <PartyTypeBadge type={relation.party.tipe_pihak} />}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Peran: {relation.peran || '—'}
                      {relation.keterangan ? ` — ${relation.keterangan}` : ''}
                    </p>
                    {(relation.party?.nik || relation.party?.nomor_telepon) && (
                      <p className="mt-0.5 font-mono text-xs text-slate-400">
                        {[relation.party?.nik, relation.party?.nomor_telepon]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          id: relation.id,
                          peran: relation.peran ?? '',
                          keterangan: relation.keterangan ?? '',
                        })
                      }
                      className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                    >
                      Ubah
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRemoveRelation(relation)}
                      className="text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
