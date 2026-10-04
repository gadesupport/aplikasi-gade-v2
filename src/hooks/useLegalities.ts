import { useCallback, useEffect, useState } from 'react'
import { legalityService } from '../services/legalityService'
import type { LegalityListRow } from '../services/legalityService'
import type { Paginated } from '../types/pagination'
import type { LegalityRecord } from '../types/legality'

interface UseLegalityListOptions {
  search: string
  status: string | null
  jenis: string | null
  lokasiId: string | null
  page: number
  pageSize?: number
}

interface ListState {
  result: Paginated<LegalityListRow>
  isLoading: boolean
  error: string | null
}

// List global legalitas (menu Legalitas) — filter + pagination.
export function useLegalityList({
  search,
  status,
  jenis,
  lokasiId,
  page,
  pageSize = 20,
}: UseLegalityListOptions): ListState {
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
    legalityService
      .list({
        search: debouncedSearch,
        status: (status as LegalityRecord['status']) || undefined,
        jenis: (jenis as LegalityRecord['jenis_dokumen']) || undefined,
        lokasiId: lokasiId || undefined,
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
            error: err instanceof Error ? err.message : 'Gagal memuat data legalitas.',
          }))
        }
      })
    return () => {
      active = false
    }
  }, [debouncedSearch, status, jenis, lokasiId, page, pageSize])

  return state
}

interface ParcelLegalitiesState {
  rows: LegalityRecord[]
  isLoading: boolean
  error: string | null
  reload: () => void
}

// Baris legalitas satu bidang — checklist di LegalitiesSection mengagregasinya.
export function useParcelLegalities(parcelId: string | undefined): ParcelLegalitiesState {
  const [rows, setRows] = useState<LegalityRecord[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(parcelId))
  const [error, setError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!parcelId) {
      setRows([])
      setIsLoading(false)
      setError(null)
      return
    }
    let active = true
    setIsLoading(true)
    setError(null)
    legalityService
      .listByParcel(parcelId)
      .then((data) => {
        if (active) {
          setRows(data)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat legalitas.')
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [parcelId, reloadCount])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return { rows, isLoading, error, reload }
}
