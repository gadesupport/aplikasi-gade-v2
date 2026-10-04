import { useEffect, useMemo, useState } from 'react'
import type { Feature, FeatureCollection } from 'geojson'
import AreaStatusBadge from './AreaStatusBadge'
import MapView from './MapView'
import type { MapOverlay } from './MapView'
import PolygonEditor from './PolygonEditor'
import type { PolygonEditorGuide } from './PolygonEditor'
import { useLocationAreaStats } from '../hooks/useLocationAreaStats'
import { useLocationGeometry } from '../hooks/useLocationGeometry'
import { useParcelsGeometries } from '../hooks/useParcelsGeometries'
import { formatLuas } from '../lib/format'
import { mapService } from '../services/mapService'

const OUTLINE_STYLE = { color: '#059669', weight: 2, fill: false }
const PARCEL_STYLE = {
  color: '#3b82f6',
  weight: 1.5,
  fillColor: '#3b82f6',
  fillOpacity: 0.1,
}
const GUIDE_OTHER_LOCATION_STYLE = { color: '#94a3b8', weight: 1, dashArray: '4 4', fill: false }

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  )
}

import GisImportModal from './GisImportModal'

interface LocationGeometrySectionProps {
  locationId: string
  locationKode?: string
  locationNama?: string
  onImportSuccess?: () => void
}

// Section peta pada halaman detail lokasi. Mode view menampilkan batas
// induk sebagai outline (AGENTS.md §17.1) + seluruh bidang pada lokasi +
// statistik pemetaan (§17.6); mode edit membuka PolygonEditor dengan
// snapping ke batas lokasi lain.
export default function LocationGeometrySection({
  locationId,
  locationKode,
  locationNama,
  onImportSuccess,
}: LocationGeometrySectionProps) {
  const { geometry, isLoading, error, reload } = useLocationGeometry(locationId)
  const { collection: parcels, reload: reloadParcels } = useParcelsGeometries(locationId)
  const { stats, isLoading: statsLoading, error: statsError, reload: reloadStats } =
    useLocationAreaStats(locationId)
  const [isEditing, setIsEditing] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [otherLocations, setOtherLocations] = useState<FeatureCollection>({
    type: 'FeatureCollection',
    features: [],
  })

  useEffect(() => {
    let active = true
    mapService
      .getOtherLocationGeometries(locationId)
      .then((collection) => {
        if (active) setOtherLocations(collection)
      })
      .catch(() => {
        // Guide bersifat opsional — snapping ke batas sendiri tetap bekerja.
      })
    return () => {
      active = false
    }
  }, [locationId])

  const outline = useMemo<Feature | null>(
    () => (geometry ? { type: 'Feature', properties: {}, geometry } : null),
    [geometry],
  )

  const viewOverlays = useMemo<MapOverlay[]>(() => {
    if (parcels.features.length === 0) return []
    return [{ geojson: parcels, style: PARCEL_STYLE }]
  }, [parcels])

  const editorGuides = useMemo<PolygonEditorGuide[]>(
    () =>
      otherLocations.features.length > 0
        ? [{ geojson: otherLocations, style: GUIDE_OTHER_LOCATION_STYLE }]
        : [],
    [otherLocations],
  )

  if (isEditing) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Edit Batas Lokasi</h2>
          <span className="text-xs font-medium text-amber-600">
            Mode edit — perubahan belum tersimpan sampai Simpan
          </span>
        </div>
        <PolygonEditor
          entityLabel="lokasi"
          initialGeometry={geometry}
          guides={editorGuides}
          onSave={async (polygon) => {
            await mapService.saveLocationGeometry(locationId, polygon)
            reload()
            reloadStats()
            setIsEditing(false)
          }}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Batas Lokasi (Peta)</h2>
          <p className="text-xs text-slate-500">
            Visualisasi batas induk, bidang terpetakan, dan import GIS.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
          >
            <svg
              className="h-4 w-4 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            Impor KML / SHP
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-700"
          >
            {geometry ? 'Edit Batas' : 'Gambar Batas'}
          </button>
        </div>
      </div>

      {isImportModalOpen && (
        <GisImportModal
          locationId={locationId}
          locationLabel={
            locationKode && locationNama ? `${locationKode} — ${locationNama}` : locationKode
          }
          parentGeometry={geometry}
          existingParcels={parcels}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            reload()
            reloadStats()
            reloadParcels()
            onImportSuccess?.()
          }}
        />
      )}

      <div className="p-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : isLoading ? (
          <div className="flex h-96 items-center justify-center gap-3 rounded-xl border border-slate-200 text-sm text-slate-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
            Memuat batas lokasi…
          </div>
        ) : (
          <>
            <MapView
              geojson={outline}
              geojsonStyle={OUTLINE_STYLE}
              fitGeojson={Boolean(outline)}
              overlays={viewOverlays}
              className="h-96 w-full"
            />
            <p className="mt-2 text-xs text-slate-400">
              {geometry
                ? 'Batas induk ditampilkan sebagai outline hijau; bidang pada lokasi ini ditampilkan biru. Klik "Edit Batas" untuk mengubah.'
                : 'Belum ada batas. Klik "Gambar Batas" untuk membuat polygon induk lokasi.'}
              {parcels.features.length > 0 ? ` ${parcels.features.length} bidang termuat.` : ''}
            </p>

            {statsError ? (
              <p className="mt-3 text-xs text-red-600">{statsError}</p>
            ) : statsLoading || !stats ? null : (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">Pemetaan Area</span>
                    <AreaStatusBadge status={stats.status_pemetaan} />
                  </div>
                  <span className="text-lg font-bold text-emerald-600">
                    {stats.coverage_percent === null
                      ? '—'
                      : `${stats.coverage_percent}% terpetakan`}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <StatCell label="Luas Parent" value={formatLuas(stats.luas_parent_m2)} />
                  <StatCell
                    label="Total Luas Bidang"
                    value={formatLuas(stats.luas_bidang_netto_m2)}
                  />
                  <StatCell label="Sisa Luas" value={formatLuas(stats.sisa_luas_m2)} />
                  <StatCell
                    label="Bidang Terpetakan"
                    value={`${stats.bidang_terpetakan} / ${stats.bidang_total}`}
                  />
                </dl>
                {stats.status_pemetaan === 'OVERLAP' && (
                  <p className="mt-3 text-xs text-red-600">
                    Ada bidang yang bertumpuk: total luas bidang bruto{' '}
                    {formatLuas(stats.luas_bidang_bruto_m2)} vs netto{' '}
                    {formatLuas(stats.luas_bidang_netto_m2)}. Perbaiki polygon bidang yang overlap.
                  </p>
                )}
                {stats.status_pemetaan === 'GEOMETRY_INVALID' && (
                  <p className="mt-3 text-xs text-violet-600">
                    Ada geometry tidak valid pada lokasi/bidang ini. Hubungi administrator.
                  </p>
                )}
                {stats.luas_parent_m2 === null && (
                  <p className="mt-3 text-xs text-slate-500">
                    Statistik lengkap tersedia setelah batas induk digambar.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
