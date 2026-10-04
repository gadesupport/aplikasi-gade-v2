import { useEffect, useState } from 'react'
import { mapService } from '../services/mapService'
import type { GeoPoint, NearestLocation, NearestParcel } from '../types/map'

interface NearestSearchState {
  parcels: NearestParcel[]
  locations: NearestLocation[]
  isLoading: boolean
  error: string | null
}

// Hasil pencarian terdekat untuk satu titik (RPC PostGIS §17.7).
// Tanpa titik → state kosong.
export function useNearestSearch(point: GeoPoint | null, limit = 5): NearestSearchState {
  const [state, setState] = useState<NearestSearchState>({
    parcels: [],
    locations: [],
    isLoading: false,
    error: null,
  })

  useEffect(() => {
    if (!point) {
      setState({ parcels: [], locations: [], isLoading: false, error: null })
      return
    }
    let active = true
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    Promise.all([
      mapService.findNearestParcels(point.lat, point.lng, limit),
      mapService.findNearestLocations(point.lat, point.lng, limit),
    ])
      .then(([parcels, locations]) => {
        if (active) setState({ parcels, locations, isLoading: false, error: null })
      })
      .catch((err) => {
        if (active) {
          setState({
            parcels: [],
            locations: [],
            isLoading: false,
            error: err instanceof Error ? err.message : 'Gagal memuat hasil terdekat.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [point?.lat, point?.lng, limit])

  return state
}
