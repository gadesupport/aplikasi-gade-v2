import { useMemo, useState } from 'react'
import type { Feature } from 'geojson'
import MapView from './MapView'
import type { MapOverlay } from './MapView'
import PolygonEditor from './PolygonEditor'
import type { PolygonEditorGuide } from './PolygonEditor'
import { useLocationGeometry } from '../hooks/useLocationGeometry'
import { useParcelGeometry } from '../hooks/useParcelGeometry'
import { useParcelsGeometries } from '../hooks/useParcelsGeometries'
import { mapService } from '../services/mapService'

const PARENT_OUTLINE_STYLE = { color: '#059669', weight: 2, fill: false }
const OTHER_PARCEL_STYLE = {
  color: '#3b82f6',
  weight: 1.5,
  fillColor: '#3b82f6',
  fillOpacity: 0.08,
}
const ACTIVE_PARCEL_STYLE = {
  color: '#059669',
  weight: 2.5,
  fillColor: '#059669',
  fillOpacity: 0.18,
}
const GUIDE_PARENT_STYLE = { color: '#059669', weight: 2, fill: false }
const GUIDE_OTHER_STYLE = {
  color: '#3b82f6',
  weight: 1.5,
  dashArray: '4 4',
  fill: false,
}

interface ParcelGeometrySectionProps {
  parcelId: string
  locationId: string
}

// Section peta pada halaman detail bidang. Mode view menampilkan batas
// induk (outline) + seluruh bidang pada lokasi, dengan bidang ini
// di-highlight; mode edit membuka PolygonEditor dengan snapping ke batas
// induk dan bidang lain (AGENTS.md §17.2/§17.4).
export default function ParcelGeometrySection({ parcelId, locationId }: ParcelGeometrySectionProps) {
  const { geometry, isLoading, error, reload } = useParcelGeometry(parcelId)
  const { geometry: parentGeometry, isLoading: parentLoading } = useLocationGeometry(locationId)
  const { collection: others, reload: reloadOthers } = useParcelsGeometries(locationId, parcelId)
  const [isEditing, setIsEditing] = useState(false)

  const activeFeature = useMemo<Feature | null>(
    () => (geometry ? { type: 'Feature', properties: {}, geometry } : null),
    [geometry],
  )

  const viewOverlays = useMemo<MapOverlay[]>(() => {
    const overlays: MapOverlay[] = []
    if (parentGeometry) {
      overlays.push({ geojson: parentGeometry, style: PARENT_OUTLINE_STYLE })
    }
    if (others.features.length > 0) {
      overlays.push({ geojson: others, style: OTHER_PARCEL_STYLE })
    }
    if (activeFeature) {
      overlays.push({ geojson: activeFeature, style: ACTIVE_PARCEL_STYLE })
    }
    return overlays
  }, [parentGeometry, others, activeFeature])

  const editorGuides = useMemo<PolygonEditorGuide[]>(() => {
    const guides: PolygonEditorGuide[] = []
    if (parentGeometry) {
      guides.push({ geojson: parentGeometry, style: GUIDE_PARENT_STYLE })
    }
    if (others.features.length > 0) {
      guides.push({ geojson: others, style: GUIDE_OTHER_STYLE })
    }
    return guides
  }, [parentGeometry, others])

  const isLoadingAll = isLoading || parentLoading

  if (isEditing) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Edit Polygon Bidang</h2>
          <span className="text-xs font-medium text-amber-600">
            Mode edit — perubahan belum tersimpan sampai Simpan
          </span>
        </div>
        <PolygonEditor
          entityLabel="bidang"
          initialGeometry={geometry}
          guides={editorGuides}
          onSave={async (polygon) => {
            await mapService.saveParcelGeometry(parcelId, polygon)
            reload()
            reloadOthers()
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
        <h2 className="text-base font-semibold text-slate-900">Polygon Bidang (Peta)</h2>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          {geometry ? 'Edit Polygon' : 'Gambar Polygon'}
        </button>
      </div>

      <div className="p-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : isLoadingAll ? (
          <div className="flex h-96 items-center justify-center gap-3 rounded-xl border border-slate-200 text-sm text-slate-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
            Memuat polygon bidang…
          </div>
        ) : (
          <>
            <MapView
              geojson={activeFeature}
              geojsonStyle={ACTIVE_PARCEL_STYLE}
              fitGeojson={Boolean(activeFeature)}
              overlays={viewOverlays}
              className="h-96 w-full"
            />
            <p className="mt-2 text-xs text-slate-400">
              Menampilkan seluruh bidang pada lokasi ini — bidang aktif di-highlight hijau, batas
              induk sebagai outline{parentGeometry ? '' : ' (belum digambar)'}.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
