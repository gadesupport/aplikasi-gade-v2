import { useEffect, useState } from 'react'
import { locationService } from '../services/locationService'
import type { Paginated } from '../types/pagination'
import type { LocationRecord, LocationStatus } from '../types/location'

interface UseLocationsOptions {
  search: string
  status: LocationStatus | null
  page: number
  pageSize?: number
}

interface ListState {
  result: Paginated<LocationRecord>
  isLoading: boolean
  error: string | null
}

// Daftar lokasi dengan pencarian ter-debounce 300ms, filter status, dan pagination.
export function useLocations({ search, status, page, pageSize = 20 }: UseLocationsOptions): ListState {
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const [state, setState] = useState<ListState>({
    result: { data: [], total: 0, page: 1, pageSize },
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let active = true
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    locationService
      .list({ search: debouncedSearch, status: status ?? undefined, page, pageSize })
      .then((result) => {
        if (active) setState({ result, isLoading: false, error: null })
      })
      .catch((err) => {
        if (active) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Gagal memuat data lokasi.',
          }))
        }
      })
    return () => {
      active = false
    }
  }, [debouncedSearch, status, page, pageSize])

  return state
}

interface DetailState {
  location: LocationRecord | null
  isLoading: boolean
  error: string | null
}

// Detail satu lokasi. Tanpa id (mode tambah) hook mengembalikan state kosong.
export function useLocationDetail(id: string | undefined): DetailState {
  const [state, setState] = useState<DetailState>({
    location: null,
    isLoading: Boolean(id),
    error: null,
  })

  useEffect(() => {
    if (!id) {
      setState({ location: null, isLoading: false, error: null })
      return
    }
    let active = true
    setState({ location: null, isLoading: true, error: null })
    locationService
      .getById(id)
      .then((location) => {
        if (active) setState({ location, isLoading: false, error: null })
      })
      .catch((err) => {
        if (active) {
          setState({
            location: null,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Gagal memuat lokasi.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [id])

  return state
}
