import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Map as LeafletMap, PathOptions } from 'leaflet'
import type { GeoJsonObject } from 'geojson'
import 'leaflet/dist/leaflet.css'
// Leaflet-Geoman ter-registrasi pada setiap instance peta (L.map.pm) —
// siap dipakai modul Peta (AGENTS.md §17). Toolbar editing TIDAK diaktifkan
// di sini: komponen ini netral, tanpa logika GIS bisnis.
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import { cn } from '../lib/cn'

// Ikon marker default Leaflet rusak saat dibundel — arahkan ke aset paket.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

export interface MapMarker {
  id: string
  lat: number
  lng: number
  title?: string
}

// Layer tambahan di atas layer utama — memoize array ini di pemanggil agar
// layer tidak dirender ulang setiap re-render.
export interface MapOverlay {
  geojson: GeoJsonObject | null
  style?: PathOptions
}

export interface MapViewProps {
  // Center & zoom hanya dipakai saat peta diinisialisasi.
  center?: [number, number]
  zoom?: number
  markers?: MapMarker[]
  // GeoJSON (FeatureCollection/Geometry) untuk layer utama — dihapus &
  // diganti ulang setiap kali prop berubah.
  geojson?: GeoJsonObject | null
  geojsonStyle?: PathOptions
  fitGeojson?: boolean
  overlays?: MapOverlay[]
  className?: string
  onMarkerClick?: (marker: MapMarker) => void
  // Klik titik kosong pada peta (lat/lng WGS84).
  onMapClick?: (lat: number, lng: number) => void
  // Akses instance Leaflet untuk kebutuhan modul Peta nanti (mis. L.map.pm).
  onReady?: (map: LeafletMap) => void
}

// Komponen peta reusable di atas Leaflet (+ Leaflet-Geoman terpasang):
// tampil, zoom, pan, marker, dan GeoJSON layer. Basemap OpenStreetMap.
export default function MapView({
  center = [-6.2, 106.8],
  zoom = 13,
  markers = [],
  geojson = null,
  geojsonStyle,
  fitGeojson = true,
  overlays = [],
  className,
  onMarkerClick,
  onMapClick,
  onReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerLayerRef = useRef<L.LayerGroup | null>(null)
  const geojsonLayerRef = useRef<L.GeoJSON | null>(null)
  const overlayLayersRef = useRef<L.GeoJSON[]>([])
  const markerClickRef = useRef(onMarkerClick)
  const mapClickRef = useRef(onMapClick)
  const readyRef = useRef(onReady)

  useEffect(() => {
    markerClickRef.current = onMarkerClick
  })

  useEffect(() => {
    mapClickRef.current = onMapClick
  })

  useEffect(() => {
    readyRef.current = onReady
  })

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { center, zoom, scrollWheelZoom: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    markerLayerRef.current = L.layerGroup().addTo(map)
    map.on('click', (event: L.LeafletMouseEvent) => {
      mapClickRef.current?.(event.latlng.lat, event.latlng.lng)
    })
    mapRef.current = map
    readyRef.current?.(map)

    return () => {
      map.remove()
      mapRef.current = null
      markerLayerRef.current = null
      geojsonLayerRef.current = null
    }
    // center/zoom sengaja hanya dipakai saat inisialisasi peta.
  }, [])

  useEffect(() => {
    const layer = markerLayerRef.current
    if (!layer) return
    layer.clearLayers()
    for (const marker of markers) {
      const leafletMarker = L.marker([marker.lat, marker.lng], { title: marker.title })
      if (marker.title) leafletMarker.bindPopup(marker.title)
      leafletMarker.on('click', () => markerClickRef.current?.(marker))
      leafletMarker.addTo(layer)
    }
  }, [markers])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (geojsonLayerRef.current) {
      map.removeLayer(geojsonLayerRef.current)
      geojsonLayerRef.current = null
    }
    if (!geojson) return
    const layer = L.geoJSON(geojson, { style: geojsonStyle })
    layer.addTo(map)
    geojsonLayerRef.current = layer
    if (fitGeojson) {
      const bounds = layer.getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [24, 24] })
      }
    }
    setTimeout(() => map.invalidateSize(), 50)
  }, [geojson, geojsonStyle, fitGeojson])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    overlayLayersRef.current.forEach((layer) => map.removeLayer(layer))
    overlayLayersRef.current = []
    const bounds = L.latLngBounds([])
    for (const overlay of overlays) {
      if (!overlay.geojson) continue
      const layer = L.geoJSON(overlay.geojson, { style: overlay.style })
      layer.addTo(map)
      overlayLayersRef.current.push(layer)
      const b = layer.getBounds()
      if (b.isValid()) bounds.extend(b)
    }
    // Jika tidak ada layer geojson utama, zoom ke overlays agar data langsung tampak
    if (!geojson && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24] })
    }
    setTimeout(() => map.invalidateSize(), 50)
  }, [overlays, geojson])

  return (
    <div className={cn('relative z-0', className ?? 'h-96 w-full')}>
      <div ref={containerRef} className="h-full w-full rounded-xl border border-slate-200" />
    </div>
  )
}
