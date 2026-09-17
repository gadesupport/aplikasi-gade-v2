import { useCallback, useEffect, useState } from 'react'
import { partyService } from '../services/partyService'
import type { Paginated } from '../types/pagination'
import type { ParcelPartyWithParty, PartyRecord, PartyType } from '../types/party'

interface UsePartiesOptions {
  search: string
  tipe: PartyType | null
  page: number
  pageSize?: number
}

interface ListState {
  result: Paginated<PartyRecord>
  isLoading: boolean
  error: string | null
}

// Daftar pihak dengan pencarian ter-debounce 300ms, filter tipe, dan pagination.
export function useParties({ search, tipe, page, pageSize = 20 }: UsePartiesOptions): ListState {
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
    partyService
      .list({ search: debouncedSearch, tipe: tipe ?? undefined, page, pageSize })
      .then((result) => {
        if (active) setState({ result, isLoading: false, error: null })
      })
      .catch((err) => {
        if (active) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Gagal memuat data pihak.',
          }))
        }
      })
    return () => {
      active = false
    }
  }, [debouncedSearch, tipe, page, pageSize])

  return state
}

interface DetailState {
  party: PartyRecord | null
  isLoading: boolean
  error: string | null
}

// Detail satu pihak. Tanpa id (mode tambah) hook mengembalikan state kosong.
export function usePartyDetail(id: string | undefined): DetailState {
  const [state, setState] = useState<DetailState>({
    party: null,
    isLoading: Boolean(id),
    error: null,
  })

  useEffect(() => {
    if (!id) {
      setState({ party: null, isLoading: false, error: null })
      return
    }
    let active = true
    setState({ party: null, isLoading: true, error: null })
    partyService
      .getById(id)
      .then((party) => {
        if (active) setState({ party, isLoading: false, error: null })
      })
      .catch((err) => {
        if (active) {
          setState({
            party: null,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Gagal memuat pihak.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [id])

  return state
}

interface ParcelPartiesState {
  relations: ParcelPartyWithParty[]
  isLoading: boolean
  error: string | null
  reload: () => void
}

// Relasi pihak pada satu bidang; reload() dipanggil setelah mutasi.
export function useParcelParties(parcelId: string | undefined): ParcelPartiesState {
  const [relations, setRelations] = useState<ParcelPartyWithParty[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(parcelId))
  const [error, setError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!parcelId) {
      setRelations([])
      setIsLoading(false)
      setError(null)
      return
    }
    let active = true
    setIsLoading(true)
    setError(null)
    partyService
      .listByParcel(parcelId)
      .then((rows) => {
        if (active) {
          setRelations(rows)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat pihak terkait.')
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [parcelId, reloadCount])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return { relations, isLoading, error, reload }
}
