import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import type { PathOptions } from 'leaflet'
import type { GeoJsonObject, Polygon } from 'geojson'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import { cn } from '../lib/cn'

type EditMode = 'none' | 'draw' | 'vertex' | 'drag'

const MODE_HINTS: Record<EditMode, string | null> = {
  none: null,
  draw: 'Klik pada peta untuk menambah titik; klik titik pertama (atau tekan Enter) untuk menutup polygon.',
  vertex: 'Tarik vertex untuk memindah • tarik titik tengah sisi untuk menambah vertex • klik-kanan vertex untuk menghapus.',
  drag: 'Tarik polygon untuk memindahkan seluruh batas.',
}

const buttonBase =
  'rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50'

const actionButton = cn(buttonBase, 'border border-slate-300 text-slate-700 hover:bg-slate-50')
const actionButtonActive = cn(buttonBase, 'bg-emerald-600 text-white hover:bg-emerald-700')

// Layer panduan: dirender non-interaktif dan menjadi sasaran snapping.
export interface PolygonEditorGuide {
  geojson: GeoJsonObject | null
  style?: PathOptions
}

interface PolygonEditorProps {
  initialGeometry: Polygon | null
  // Panduan snapping (mis. batas induk & bidang lain) — memoize di pemanggil.
  guides?: PolygonEditorGuide[]
  // Nama entitas untuk pesan konfirmasi (mis. "lokasi", "bidang").
  entityLabel: string
  // Dipanggil saat Simpan; throw ServiceError untuk menampilkan pesan error.
  onSave: (polygon: Polygon | null) => Promise<void>
  onCancel: () => void
}

// Editor polygon generik (AGENTS.md §17.1/§17.2/§17.3/§17.4) di atas
// Leaflet-Geoman: draw polygon, edit/tambah/hapus/pindah vertex, drag
// polygon, snapping (ke polygon sendiri + semua layer panduan, jarak
// dapat diatur), simpan, dan batal. Dipakai editor batas lokasi maupun
// polygon bidang.
export default function PolygonEditor({
  initialGeometry,
  guides = [],
  entityLabel,
  onSave,
  onCancel,
}: PolygonEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const polygonRef = useRef<L.Polygon | null>(null)
  const guideLayersRef = useRef<L.GeoJSON[]>([])
  const fitToGuidesDoneRef = useRef(false)
  const [mode, setMode] = useState<EditMode>(initialGeometry ? 'vertex' : 'none')
  const [hasPolygon, setHasPolygon] = useState(Boolean(initialGeometry))
  const [snapDistance, setSnapDistance] = useState(20)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, { center: [-6.2, 106.8], zoom: 13 })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    // Snapping aktif: ke vertex/endpoint/edge polygon sendiri dan semua
    // layer panduan (snapMiddle menambah titik tengah sisi).
    map.pm.setGlobalOptions({
      snappable: true,
      snapDistance: 20,
      snapMiddle: true,
      allowSelfIntersection: false,
    })
    mapRef.current = map

    if (initialGeometry) {
      const layer = L.geoJSON(initialGeometry).addTo(map)
      const polygon = layer.getLayers()[0] as L.Polygon
      polygonRef.current = polygon
      setHasPolygon(true)
      map.fitBounds(polygon.getBounds(), { padding: [24, 24] })
      polygon.pm.enable({ allowSelfIntersection: false })
    }

    map.on('pm:create', (event: L.LeafletEvent) => {
      const polygon = (event as unknown as { layer: L.Layer }).layer as L.Polygon
      polygonRef.current = polygon
      setHasPolygon(true)
      map.pm.disableDraw()
      polygon.pm.enable({ allowSelfIntersection: false })
      setMode('vertex')
    })

    return () => {
      map.remove()
      mapRef.current = null
      polygonRef.current = null
      guideLayersRef.current = []
      fitToGuidesDoneRef.current = false
    }
  }, [initialGeometry])

  // Render ulang layer panduan saat daftar guides berubah (mis. data induk
  // tiba asynchronous). Saat polygon belum ada dan panduan pertama kali
  // tersedia, arahkan peta ke panduan tersebut sekali.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    guideLayersRef.current.forEach((layer) => map.removeLayer(layer))
    guideLayersRef.current = []
    let guideBounds: L.LatLngBounds | null = null
    for (const guide of guides) {
      if (!guide.geojson) continue
      const layer = L.geoJSON(guide.geojson, { style: guide.style, interactive: false })
      layer.addTo(map)
      guideLayersRef.current.push(layer)
      const bounds = layer.getBounds()
      if (bounds.isValid()) {
        guideBounds = guideBounds ? guideBounds.extend(bounds) : bounds
      }
    }
    if (!polygonRef.current && guideBounds && !fitToGuidesDoneRef.current) {
      map.fitBounds(guideBounds, { padding: [24, 24] })
      fitToGuidesDoneRef.current = true
    }
  }, [guides])

  useEffect(() => {
    mapRef.current?.pm.setGlobalOptions({ snapDistance })
  }, [snapDistance])

  function resetModes() {
    mapRef.current?.pm.disableDraw()
    polygonRef.current?.pm.disable()
    polygonRef.current?.pm.disableLayerDrag()
  }

  function startDraw() {
    resetModes()
    setError(null)
    mapRef.current?.pm.enableDraw('Polygon')
    setMode('draw')
  }

  function toggleVertexEdit() {
    if (!polygonRef.current) return
    setError(null)
    if (mode === 'vertex') {
      polygonRef.current.pm.disable()
      setMode('none')
      return
    }
    resetModes()
    polygonRef.current.pm.enable({ allowSelfIntersection: false })
    setMode('vertex')
  }

  function toggleDrag() {
    if (!polygonRef.current) return
    setError(null)
    if (mode === 'drag') {
      polygonRef.current.pm.disableLayerDrag()
      setMode('none')
      return
    }
    resetModes()
    polygonRef.current.pm.enableLayerDrag()
    setMode('drag')
  }

  function handleClear() {
    const polygon = polygonRef.current
    if (!polygon) return
    if (!window.confirm('Hapus polygon dari peta? Perubahan belum tersimpan sampai Simpan.')) return
    resetModes()
    polygon.remove()
    polygonRef.current = null
    setHasPolygon(false)
    setMode('none')
  }

  async function handleSave() {
    const polygon = polygonRef.current
    setError(null)
    try {
      if (mode === 'draw') {
        setError('Selesaikan penggambaran polygon terlebih dahulu.')
        return
      }
      if (!polygon) {
        if (!initialGeometry) {
          setError('Belum ada polygon untuk disimpan. Gambar polygon terlebih dahulu.')
          return
        }
        if (!window.confirm(`Simpan tanpa batas? Polygon ${entityLabel} akan dihapus.`)) return
      }
      setIsSaving(true)
      const geometry = polygon ? (polygon.toGeoJSON().geometry as Polygon) : null
      await onSave(geometry)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan polygon.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {!hasPolygon && (
          <button
            type="button"
            onClick={startDraw}
            className={mode === 'draw' ? actionButtonActive : actionButton}
          >
            Gambar Polygon
          </button>
        )}
        {hasPolygon && (
          <>
            <button
              type="button"
              onClick={toggleVertexEdit}
              className={mode === 'vertex' ? actionButtonActive : actionButton}
            >
              Edit Vertex
            </button>
            <button
              type="button"
              onClick={toggleDrag}
              className={mode === 'drag' ? actionButtonActive : actionButton}
            >
              Geser Polygon
            </button>
            <button
              type="button"
              onClick={handleClear}
              className={cn(buttonBase, 'border border-red-300 text-red-600 hover:bg-red-50')}
            >
              Hapus Polygon
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="snap-distance" className="text-xs font-medium text-slate-600">
            Snap (px)
          </label>
          <input
            id="snap-distance"
            type="number"
            min={1}
            max={80}
            value={snapDistance}
            onChange={(event) => setSnapDistance(Math.max(1, Number(event.target.value) || 1))}
            className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel} className={actionButton}>
            Batal
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || (!hasPolygon && !initialGeometry)}
            className={cn(buttonBase, 'bg-emerald-600 text-white hover:bg-emerald-700')}
          >
            {isSaving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>

      <div className="relative z-0">
        <div
          ref={containerRef}
          className="h-[480px] w-full rounded-xl border border-slate-200"
        />
      </div>

      {(error || MODE_HINTS[mode]) && (
        <p
          className={cn(
            'text-xs',
            error ? 'text-red-600' : 'text-slate-500',
          )}
        >
          {error ?? MODE_HINTS[mode]}
        </p>
      )}
      <p className="text-xs text-slate-400">
        Snapping otomatis aktif ke vertex/endpoint/edge polygon ini dan semua layer panduan yang
        ditampilkan.
      </p>
    </div>
  )
}
