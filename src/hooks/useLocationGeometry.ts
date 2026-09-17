import { useCallback, useEffect, useState } from 'react'
import { mapService } from '../services/mapService'
import type { Polygon } from 'geojson'

interface LocationGeometryState {
  geometry: Polygon | null
  isLoading: boolean
  error: string | null
  reload: () => void
}

// Geometry batas lokasi; reload() dipanggil setelah editor menyimpan.
export function useLocationGeometry(locationId: string | undefined): LocationGeometryState {
  const [geometry, setGeometry] = useState<Polygon | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(locationId))
  const [error, setError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!locationId) {
      setGeometry(null)
      setIsLoading(false)
      setError(null)
      return
    }
    let active = true
    setIsLoading(true)
    setError(null)
    mapService
      .getLocationGeometry(locationId)
      .then((data) => {
        if (active) {
          setGeometry(data)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat batas lokasi.')
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [locationId, reloadCount])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return { geometry, isLoading, error, reload }
}
