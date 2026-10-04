import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from '../components/Badge'
import ParcelStatusBadge from '../components/ParcelStatusBadge'
import { gisExportService } from '../services/gisExportService'
import type { ExportScope } from '../services/gisExportService'
import { parcelService } from '../services/parcelService'
import type { ParcelWithLocation } from '../types/parcel'
import { PARCEL_STATUSES, PARCEL_STATUS_LABELS } from '../types/parcel'
import type { ParcelStatus } from '../types/parcel'
import type { ExportBundle, ExportFormat } from '../lib/gis/export/types'

const FORMAT_LABELS: Record<ExportFormat, string> = {
  GEOJSON: 'GeoJSON (.geojson)',
  KML: 'KML (.kml)',
  SHP: 'SHP ZIP (.zip: shp/shx/dbf/prj)',
  DXF: 'DXF (.dxf)',
}

const SCOPE_LABELS: Record<ExportScope, string> = {
  SEMUA: 'Semua',
  LOKASI: 'Per Lokasi',
  BIDANG: 'Per Bidang',
  TERPILIH: 'Bidang Terpilih',
  FILTER: 'Hasil Filter',
}

export default function GISExportPage() {
  const [scope, setScope] = useState<ExportScope>('SEMUA')
  const [lokasiOptions, setLokasiOptions] = useState<{ id: string; kode: string; nama: string }[]>([])
  const [lokasiId, setLokasiId] = useState('')
  const [parcelOptions, setParcelOptions] = useState<ParcelWithLocation[]>([])
  const [parcelId, setParcelId] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<ParcelStatus | null>(null)
  const [parcelSearch, setParcelSearch] = useState('')
  const [parcelMatches, setParcelMatches] = useState<ParcelWithLocation[]>([])
  const [format, setFormat] = useState<ExportFormat>('GEOJSON')
  const [bundle, setBundle] = useState<ExportBundle | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneFile, setDoneFile] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    locationOptionsLoad(active)
    return () => {
      active = false
    }
    async function locationOptionsLoad(active: boolean) {
      try {
        const options = await (await import('../services/locationService')).locationService.listOptions()
        if (active) setLokasiOptions(options)
      } catch {
        // Dropdown opsional.
      }
    }
  }, [])

  // Daftar bidang untuk mode TERPILIH (ikut lokasi yang dipilih).
  useEffect(() => {
    if (scope !== 'TERPILIH' || !lokasiId) {
      setParcelOptions([])
      return
    }
    let active = true
    parcelService
      .listByLocation(lokasiId)
      .then((rows) => {
        if (active) {
          setParcelOptions(rows)
          setSelectedIds(new Set())
        }
      })
      .catch(() => {
        if (active) setParcelOptions([])
      })
    return () => {
      active = false
    }
  }, [scope, lokasiId])

  // Pencarian bidang untuk scope BIDANG (debounce 300ms).
  useEffect(() => {
    if (scope !== 'BIDANG' || parcelSearch.trim() === '') {
      setParcelMatches([])
      return
    }
    const timer = setTimeout(() => {
      parcelService
        .list({ search: parcelSearch, pageSize: 20 })
        .then((result) => setParcelMatches(result.data))
        .catch(() => setParcelMatches([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [scope, parcelSearch])

  async function loadBundle() {
    setIsLoading(true)
    setError(null)
    setDoneFile(null)
    try {
      const result = await gisExportService.fetchBundle({
        scope,
        lokasiId: lokasiId || undefined,
        parcelId: parcelId || undefined,
        parcelIds: [...selectedIds],
        status: statusFilter ?? undefined,
      })
      setBundle(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data export.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDownload() {
    if (!bundle) return
    setIsExporting(true)
    setError(null)
    try {
      const fileName = await gisExportService.exportBundle(bundle, format, SCOPE_LABELS[scope])
      setDoneFile(fileName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat file export.')
    } finally {
      setIsExporting(false)
    }
  }

  const totalFeatures = bundle ? bundle.parents.length + bundle.parcels.length : 0
  const canLoad =
    scope === 'SEMUA' ||
    (scope === 'LOKASI' && lokasiId) ||
    (scope === 'BIDANG' && parcelId) ||
    (scope === 'TERPILIH' && lokasiId && selectedIds.size > 0) ||
    scope === 'FILTER'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to="/peta" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
          ← Kembali ke Peta
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Ekspor GIS</h1>
        <p className="mt-1 text-sm text-slate-500">
          GeoJSON · KML · SHP ZIP · DXF — koordinat WGS84/EPSG:4326; export tidak mengubah
          database (AGENTS.md §26).
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 1. Scope */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">1. Cakupan Data</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(SCOPE_LABELS) as ExportScope[]).map((candidate) => (
            <label
              key={candidate}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                scope === candidate ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
              }`}
            >
              <input
                type="radio"
                name="scope"
                checked={scope === candidate}
                onChange={() => {
                  setScope(candidate)
                  setBundle(null)
                }}
                className="h-4 w-4 text-emerald-600"
              />
              {SCOPE_LABELS[candidate]}
            </label>
          ))}
        </div>

        {(scope === 'LOKASI' || scope === 'FILTER' || scope === 'TERPILIH') && (
          <div className="mt-3 max-w-md">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {scope === 'LOKASI' ? 'Lokasi' : scope === 'TERPILIH' ? 'Lokasi (pilih bidangnya)' : 'Lokasi (opsional)'}
            </label>
            <select
              value={lokasiId}
              onChange={(event) => setLokasiId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— {scope === 'FILTER' ? 'Semua lokasi' : 'Pilih lokasi'} —</option>
              {lokasiOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.kode} — {option.nama}
                </option>
              ))}
            </select>
          </div>
        )}

        {scope === 'BIDANG' && (
          <div className="mt-3 max-w-md">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Cari Bidang Tanah (kode/nomor bidang/nomor hak)
            </label>
            <input
              type="search"
              value={parcelSearch}
              onChange={(event) => setParcelSearch(event.target.value)}
              placeholder="Ketik untuk mencari…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {parcelMatches.length > 0 && (
              <select
                value={parcelId}
                onChange={(event) => setParcelId(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— Pilih bidang —</option>
                {parcelMatches.map((parcel) => (
                  <option key={parcel.id} value={parcel.id}>
                    {parcel.kode}
                    {parcel.nomor_bidang ? ` (No. ${parcel.nomor_bidang})` : ''}
                    {parcel.lokasi ? ` — ${parcel.lokasi.nama}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {scope === 'TERPILIH' && lokasiId && (
          <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200">
            {parcelOptions.length === 0 ? (
              <p className="p-3 text-sm text-slate-500">Lokasi ini belum memiliki bidang.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {parcelOptions.map((parcel) => (
                  <li key={parcel.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(parcel.id)}
                      onChange={(event) =>
                        setSelectedIds((prev) => {
                          const next = new Set(prev)
                          if (event.target.checked) next.add(parcel.id)
                          else next.delete(parcel.id)
                          return next
                        })
                      }
                      className="h-4 w-4 text-emerald-600"
                    />
                    <span className="font-mono text-xs text-slate-600">{parcel.kode}</span>
                    <span className="text-slate-700">{parcel.nomor_bidang ?? '—'}</span>
                    <ParcelStatusBadge status={parcel.status_pembebasan} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {scope === 'FILTER' && (
          <div className="mt-3 max-w-md">
            <label className="mb-1 block text-sm font-medium text-slate-700">Status Bidang</label>
            <select
              value={statusFilter ?? ''}
              onChange={(event) =>
                setStatusFilter(event.target.value === '' ? null : (event.target.value as ParcelStatus))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Semua status</option>
              {PARCEL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PARCEL_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={() => void loadBundle()}
          disabled={!canLoad || isLoading}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Memuat…' : 'Muat Data'}
        </button>

        {bundle && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="emerald">{bundle.parents.length} parent area</Badge>
            <Badge tone="sky">{bundle.parcels.length} bidang</Badge>
            <Badge tone="slate">Total {totalFeatures} fitur</Badge>
          </div>
        )}
      </div>

      {/* 2. Format & unduh */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">2. Format & Unduh</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((candidate) => (
            <label
              key={candidate}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                format === candidate ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
              }`}
            >
              <input
                type="radio"
                name="format"
                checked={format === candidate}
                onChange={() => setFormat(candidate)}
                className="h-4 w-4 text-emerald-600"
              />
              {FORMAT_LABELS[candidate]}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          SHP ZIP berisi .shp/.shx/.dbf/.prj (WGS84). DXF berisi layer GADE_PARENT, GADE_PARCEL,
          GADE_BOUNDARY, GADE_POINT, GADE_LABEL (label: kode + nomor bidang + luas).
        </p>
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={!bundle || totalFeatures === 0 || isExporting}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isExporting ? 'Menyiapkan…' : 'Unduh'}
        </button>
        {doneFile && (
          <p className="mt-2 text-sm text-emerald-700">Tersimpan: {doneFile}</p>
        )}
      </div>
    </div>
  )
}

