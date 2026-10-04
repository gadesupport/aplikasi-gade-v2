import { useCallback, useState } from 'react'
import type { GeoPoint } from '../types/map'

interface GeolocationState {
  position: GeoPoint | null
  isLoading: boolean
  error: string | null
  // HANYA dipanggil dari aksi user (klik tombol) — browser akan menampilkan
  // dialog izin. Tidak pernah ada pembacaan lokasi otomatis (§17.8).
  requestPosition: () => void
}

function toMessage(code: number): string {
  if (code === 1) return 'Izin lokasi ditolak. Aktifkan izin lokasi di browser lalu coba lagi.'
  if (code === 2) return 'Lokasi tidak tersedia. Periksa GPS/koneksi Anda.'
  if (code === 3) return 'Waktu pencarian lokasi habis. Coba lagi.'
  return 'Gagal mengambil lokasi.'
}

// Browser Geolocation API (§17.8) — sekali ambil saat tombol ditekan.
export function useGeolocation(): GeolocationState {
  const [position, setPosition] = useState<GeoPoint | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestPosition = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Browser tidak mendukung Geolocation.')
      return
    }
    setIsLoading(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setIsLoading(false)
      },
      (err) => {
        setError(toMessage(err.code))
        setIsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    )
  }, [])

  return { position, isLoading, error, requestPosition }
}
