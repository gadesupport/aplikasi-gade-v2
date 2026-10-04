import { useEffect, useState } from 'react'
import { parcelService } from '../services/parcelService'
import type { Paginated } from '../types/pagination'
import type { ParcelStatus, ParcelWithLocation } from '../types/parcel'

interface UseParcelsOptions {
  search: string
  status: ParcelStatus | null
  lokasiId: string | null
  page: number
  pageSize?: number
}

interface ListState {
  result: Paginated<ParcelWithLocation>
  isLoading: boolean
  error: string | null
  reload: () => void
}

// Daftar bidang tanah dengan pencarian ter-debounce 300ms, filter status &
// lokasi, dan pagination.
export function useParcels({
  search,
  status,
  lokasiId,
  page,
  pageSize = 20,
}: UseParcelsOptions): ListState {
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const [reloadCount, setReloadCount] = useState(0)
  const [state, setState] = useState<Omit<ListState, 'reload'>>({
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
    parcelService
      .list({
        search: debouncedSearch,
        status: status ?? undefined,
        lokasiId: lokasiId ?? undefined,
        page,
        pageSize,
      })
      .then((result) => {
        if (active) setState({ result, isLoading: false, error: null })
      })
      .catch((err) => {
        if (active) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Gagal memuat data bidang tanah.',
          }))
        }
      })
    return () => {
      active = false
    }
  }, [debouncedSearch, status, lokasiId, page, pageSize, reloadCount])

  const reload = () => setReloadCount((count) => count + 1)

  return { ...state, reload }
}

interface DetailState {
  parcel: ParcelWithLocation | null
  isLoading: boolean
  error: string | null
}

// Detail satu bidang (termasuk referensi lokasi induk). Tanpa id (mode
// tambah) hook mengembalikan state kosong.
export function useParcelDetail(id: string | undefined): DetailState {
  const [state, setState] = useState<DetailState>({
    parcel: null,
    isLoading: Boolean(id),
    error: null,
  })

  useEffect(() => {
    if (!id) {
      setState({ parcel: null, isLoading: false, error: null })
      return
    }
    let active = true
    setState({ parcel: null, isLoading: true, error: null })
    parcelService
      .getById(id)
      .then((parcel) => {
        if (active) setState({ parcel, isLoading: false, error: null })
      })
      .catch((err) => {
        if (active) {
          setState({
            parcel: null,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Gagal memuat bidang tanah.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [id])

  return state
}

interface ByLocationState {
  parcels: ParcelWithLocation[]
  isLoading: boolean
  error: string | null
  reload: () => void
}

// Daftar bidang milik satu lokasi — dipakai di halaman detail lokasi.
export function useParcelsByLocation(locationId: string | undefined): ByLocationState {
  const [reloadCount, setReloadCount] = useState(0)
  const [state, setState] = useState<{
    parcels: ParcelWithLocation[]
    isLoading: boolean
    error: string | null
  }>({
    parcels: [],
    isLoading: Boolean(locationId),
    error: null,
  })

  useEffect(() => {
    if (!locationId) {
      setState({ parcels: [], isLoading: false, error: null })
      return
    }
    let active = true
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    parcelService
      .listByLocation(locationId)
      .then((parcels) => {
        if (active) setState({ parcels, isLoading: false, error: null })
      })
      .catch((err) => {
        if (active) {
          setState({
            parcels: [],
            isLoading: false,
            error: err instanceof Error ? err.message : 'Gagal memuat bidang tanah lokasi ini.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [locationId, reloadCount])

  const reload = () => setReloadCount((count) => count + 1)

  return { ...state, reload }
}
