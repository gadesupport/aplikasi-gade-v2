import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Map as LeafletMap } from 'leaflet'
import MapView from '../components/MapView'
import { useGeolocation } from '../hooks/useGeolocation'
import { useNearestSearch } from '../hooks/useNearestSearch'
import { formatDistance, formatLuas } from '../lib/format'
import type { GeoPoint } from '../types/map'

const NEAREST_LIMIT = 5

// Halaman Peta: pencarian terdekat dari titik (§17.7) + "Gunakan Lokasi
// Saya" (browser Geolocation API, §17.8 — hanya saat tombol ditekan).
// Titik pencarian dari klik peta atau GPS; hasil: bidang & lokasi terdekat
// dengan jarak meter, terhubung ke halaman detail masing-masing.
export default function MapPage() {
  const mapRef = useRef<LeafletMap | null>(null)
  const [searchPoint, setSearchPoint] = useState<GeoPoint | null>(null)
  const geolocation = useGeolocation()
  const nearest = useNearestSearch(searchPoint, NEAREST_LIMIT)

  function handleMapClick(lat: number, lng: number) {
    setSearchPoint({ lat, lng })
  }

  // Tombol "Gunakan Lokasi Saya" — satu-satunya pemicu akses GPS.
  function handleUseMyLocation() {
    geolocation.requestPosition()
  }

  // Setelah GPS didapat: jadikan titik pencarian dan terbangkan peta ke sana.
  useEffect(() => {
    if (geolocation.position) {
      setSearchPoint(geolocation.position)
      mapRef.current?.flyTo([geolocation.position.lat, geolocation.position.lng], 15)
    }
  }, [geolocation.position])

  const markers = [
    ...(searchPoint ? [{ id: 'titik-pencarian', lat: searchPoint.lat, lng: searchPoint.lng, title: 'Titik pencarian' }] : []),
    ...(geolocation.position
      ? [{ id: 'posisi-saya', lat: geolocation.position.lat, lng: geolocation.position.lng, title: 'Posisi saya (GPS)' }]
      : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Peta</h1>
          <p className="mt-1 text-sm text-slate-500">
            Klik titik pada peta untuk mencari bidang dan lokasi terdekat.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Link
            to="/peta/impor"
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
          >
            Impor GIS
          </Link>
          <Link
            to="/peta/ekspor"
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
          >
            Ekspor GIS
          </Link>
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={geolocation.isLoading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {geolocation.isLoading ? 'Mencari posisi…' : 'Gunakan Lokasi Saya'}
          </button>
        </div>
      </div>

      {(geolocation.error || nearest.error) && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {geolocation.error ?? nearest.error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <MapView
          markers={markers}
          onMapClick={handleMapClick}
          onReady={(map) => {
            mapRef.current = map
          }}
          className="h-[420px] w-full"
        />
        <p className="mt-2 text-xs text-slate-400">
          {searchPoint
            ? `Titik pencarian: ${searchPoint.lat.toFixed(6)}, ${searchPoint.lng.toFixed(6)} — klik titik lain untuk mengganti.`
            : 'Klik titik pada peta atau gunakan lokasi GPS Anda.'}
        </p>
      </div>

      {nearest.isLoading ? (
        <div className="flex items-center justify-center gap-3 p-10 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
          Mencari terdekat…
        </div>
      ) : searchPoint ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Bidang Terdekat ({nearest.parcels.length})
              </h2>
            </div>
            {nearest.parcels.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">Tidak ada bidang terpetakan di sekitar titik ini.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {nearest.parcels.map((parcel, index) => (
                  <li key={parcel.id} className="flex items-center justify-between gap-3 px-6 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {index + 1}. {parcel.kode}
                        {parcel.nomor_bidang ? ` — No. ${parcel.nomor_bidang}` : ''}
                      </p>
                      <p className="text-xs text-slate-500">
                        {parcel.lokasi_kode} — {parcel.lokasi_nama}
                        {parcel.jenis_hak ? ` · ${parcel.jenis_hak}` : ''}
                        {parcel.luas !== null ? ` · ${formatLuas(parcel.luas)}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold text-emerald-600">
                        {formatDistance(parcel.jarak_m)}
                      </span>
                      <Link
                        to={`/bidang/${parcel.id}`}
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        Detail
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Lokasi Terdekat ({nearest.locations.length})
              </h2>
            </div>
            {nearest.locations.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">Tidak ada lokasi terpetakan di sekitar titik ini.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {nearest.locations.map((location, index) => (
                  <li key={location.id} className="flex items-center justify-between gap-3 px-6 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {index + 1}. {location.kode} — {location.nama}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold text-emerald-600">
                        {formatDistance(location.jarak_m)}
                      </span>
                      <Link
                        to={`/lokasi/${location.id}`}
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        Detail
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">Belum ada titik pencarian.</p>
          <p className="mt-1 text-sm text-slate-500">
            Klik titik pada peta, atau tekan "Gunakan Lokasi Saya" (browser akan meminta izin
            terlebih dahulu).
          </p>
        </div>
      )}
    </div>
  )
}
