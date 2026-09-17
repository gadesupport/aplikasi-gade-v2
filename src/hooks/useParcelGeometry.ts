import { useCallback, useEffect, useState } from 'react'
import { mapService } from '../services/mapService'
import type { Polygon } from 'geojson'

interface ParcelGeometryState {
  geometry: Polygon | null
  isLoading: boolean
  error: string | null
  reload: () => void
}

// Geometry bidang (child parcel); reload() dipanggil setelah editor menyimpan.
export function useParcelGeometry(parcelId: string | undefined): ParcelGeometryState {
  const [geometry, setGeometry] = useState<Polygon | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(parcelId))
  const [error, setError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!parcelId) {
      setGeometry(null)
      setIsLoading(false)
      setError(null)
      return
    }
    let active = true
    setIsLoading(true)
    setError(null)
    mapService
      .getParcelGeometry(parcelId)
      .then((data) => {
        if (active) {
          setGeometry(data)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat polygon bidang.')
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [parcelId, reloadCount])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return { geometry, isLoading, error, reload }
}
