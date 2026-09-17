import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PartyTypeBadge from '../components/PartyTypeBadge'
import { useParties } from '../hooks/useParties'
import { partyService } from '../services/partyService'
import { PARTY_TYPES, PARTY_TYPE_LABELS } from '../types/party'
import type { PartyType } from '../types/party'

export default function PartiesPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [tipeFilter, setTipeFilter] = useState<PartyType | null>(null)
  const [page, setPage] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { result, isLoading, error } = useParties({
    search: searchTerm,
    tipe: tipeFilter,
    page,
  })

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1
  const to = Math.min(result.total, result.page * result.pageSize)
  const hasFilter = searchTerm.trim() !== '' || tipeFilter !== null

  function handleSearchChange(value: string) {
    setSearchTerm(value)
    setPage(1)
  }

  function handleTipeChange(value: string) {
    setTipeFilter(value === '' ? null : (value as PartyType))
    setPage(1)
  }

  async function handleDelete(party: { id: string; nama: string }) {
    const confirmed = window.confirm(
      `Hapus pihak ${party.nama}?\nRelasi pihak ini dengan bidang tanah juga akan terhapus.`,
    )
    if (!confirmed) return
    setDeletingId(party.id)
    setDeleteError(null)
    try {
      await partyService.remove(party.id)
      setPage(1)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Gagal menghapus pihak.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pihak/Pemilik</h1>
          <p className="mt-1 text-sm text-slate-500">
            Master pihak — satu pihak dapat memiliki banyak bidang, satu bidang dapat memiliki
            banyak pihak.
          </p>
        </div>
        <Link
          to="/pihak/baru"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          + Tambah Pihak
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Cari nama, NIK, atau nomor telepon…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <select
            value={tipeFilter ?? ''}
            onChange={(event) => handleTipeChange(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 sm:w-52"
          >
            <option value="">Semua tipe</option>
            {PARTY_TYPES.map((tipe) => (
              <option key={tipe} value={tipe}>
                {PARTY_TYPE_LABELS[tipe]}
              </option>
            ))}
          </select>
        </div>

        {deleteError && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {deleteError}
          </div>
        )}

        {error ? (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-3 p-12 text-sm text-slate-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
            Memuat data pihak…
          </div>
        ) : result.data.length === 0 ? (
          <div className="m-4 rounded-lg border border-dashed border-slate-300 p-10 text-center">
            <p className="text-sm font-medium text-slate-700">Belum ada pihak.</p>
            <p className="mt-1 text-sm text-slate-500">
              {hasFilter
                ? 'Tidak ada hasil yang cocok dengan pencarian/filter.'
                : 'Mulai dengan menambahkan pihak pertama.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-medium">Nama</th>
                    <th className="px-4 py-3 font-medium">NIK</th>
                    <th className="px-4 py-3 font-medium">Telepon</th>
                    <th className="px-4 py-3 font-medium">Tipe</th>
                    <th className="px-4 py-3 font-medium">Alamat</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.data.map((party) => (
                    <tr key={party.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          to={`/pihak/${party.id}/edit`}
                          className="text-sm font-medium text-slate-900 hover:text-emerald-700"
                        >
                          {party.nama}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {party.nik || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {party.nomor_telepon || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <PartyTypeBadge type={party.tipe_pihak} />
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-sm text-slate-600">
                        {party.alamat || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            to={`/pihak/${party.id}/edit`}
                            className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                          >
                            Ubah
                          </Link>
                          <button
                            type="button"
                            onClick={() => void handleDelete(party)}
                            disabled={deletingId === party.id}
                            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingId === party.id ? 'Menghapus…' : 'Hapus'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              <span>
                Menampilkan {from}–{to} dari {result.total} pihak
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={result.page <= 1}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sebelumnya
                </button>
                <span className="text-xs text-slate-500">
                  Halaman {result.page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={result.page >= totalPages}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Menghubungkan pihak ke bidang tanah dilakukan dari halaman detail bidang terkait (bagian
        "Pihak Terkait").{' '}
        <button
          type="button"
          onClick={() => navigate('/bidang')}
          className="font-medium text-emerald-600 hover:text-emerald-700"
        >
          Lihat daftar bidang
        </button>
      </p>
    </div>
  )
}
