import { useCallback, useEffect, useState } from 'react'
import { mapService } from '../services/mapService'
import type { FeatureCollection } from 'geojson'

const EMPTY_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] }

interface ParcelsGeometriesState {
  collection: FeatureCollection
  isLoading: boolean
  error: string | null
  reload: () => void
}

// Semua polygon bidang pada satu lokasi (opsional exclude satu bidang) —
// untuk tampilan peta dan panduan snapping editor bidang.
export function useParcelsGeometries(
  locationId: string | undefined,
  excludeParcelId?: string,
): ParcelsGeometriesState {
  const [collection, setCollection] = useState<FeatureCollection>(EMPTY_COLLECTION)
  const [isLoading, setIsLoading] = useState(Boolean(locationId))
  const [error, setError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!locationId) {
      setCollection(EMPTY_COLLECTION)
      setIsLoading(false)
      setError(null)
      return
    }
    let active = true
    setIsLoading(true)
    setError(null)
    mapService
      .getLocationParcelsGeometries(locationId, excludeParcelId)
      .then((data) => {
        if (active) {
          setCollection(data)
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
  }, [locationId, excludeParcelId, reloadCount])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return { collection, isLoading, error, reload }
}
