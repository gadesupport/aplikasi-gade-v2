import { useCallback, useEffect, useState } from 'react'
import { mapService } from '../services/mapService'
import type { LocationAreaStats } from '../types/areaStats'

interface LocationAreaStatsState {
  stats: LocationAreaStats | null
  isLoading: boolean
  error: string | null
  reload: () => void
}

// Statistik pemetaan lokasi (view location_area_stats, dihitung PostGIS);
// reload() dipanggil setelah geometry induk/bidang berubah.
export function useLocationAreaStats(locationId: string | undefined): LocationAreaStatsState {
  const [stats, setStats] = useState<LocationAreaStats | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(locationId))
  const [error, setError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!locationId) {
      setStats(null)
      setIsLoading(false)
      setError(null)
      return
    }
    let active = true
    setIsLoading(true)
    setError(null)
    mapService
      .getLocationAreaStats(locationId)
      .then((data) => {
        if (active) {
          setStats(data)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat statistik area.')
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [locationId, reloadCount])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return { stats, isLoading, error, reload }
}
