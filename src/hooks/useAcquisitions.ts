import { useCallback, useEffect, useState } from 'react'
import { acquisitionService } from '../services/acquisitionService'
import type { Paginated } from '../types/pagination'
import type { AcquisitionRecap, AcquisitionStatus, AcquisitionWithParcel } from '../types/acquisition'

interface UseAcquisitionsOptions {
  lokasiId: string | null
  status: AcquisitionStatus | null
  page: number
  pageSize?: number
}

interface ListState {
  result: Paginated<AcquisitionWithParcel>
  isLoading: boolean
  error: string | null
}

// Daftar pembebasan dengan filter lokasi & status + pagination.
export function useAcquisitions({
  lokasiId,
  status,
  page,
  pageSize = 20,
}: UseAcquisitionsOptions): ListState {
  const [state, setState] = useState<ListState>({
    result: { data: [], total: 0, page: 1, pageSize },
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let active = true
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    acquisitionService
      .list({
        lokasiId: lokasiId ?? undefined,
        status: status ?? undefined,
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
            error: err instanceof Error ? err.message : 'Gagal memuat data pembebasan.',
          }))
        }
      })
    return () => {
      active = false
    }
  }, [lokasiId, status, page, pageSize])

  return state
}

interface ByParcelState {
  acquisitions: AcquisitionWithParcel[]
  isLoading: boolean
  error: string | null
  reload: () => void
}

// Pembebasan satu bidang — dipakai di halaman detail bidang.
export function useAcquisitionsByParcel(parcelId: string | undefined): ByParcelState {
  const [acquisitions, setAcquisitions] = useState<AcquisitionWithParcel[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(parcelId))
  const [error, setError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!parcelId) {
      setAcquisitions([])
      setIsLoading(false)
      setError(null)
      return
    }
    let active = true
    setIsLoading(true)
    setError(null)
    acquisitionService
      .listByParcel(parcelId)
      .then((rows) => {
        if (active) {
          setAcquisitions(rows)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat data pembebasan.')
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [parcelId, reloadCount])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return { acquisitions, isLoading, error, reload }
}

interface RecapState {
  recap: AcquisitionRecap | null
  isLoading: boolean
  error: string | null
  reload: () => void
}

// Rekap pembebasan satu lokasi — panel di halaman detail lokasi.
export function useAcquisitionRecap(locationId: string | undefined): RecapState {
  const [recap, setRecap] = useState<AcquisitionRecap | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(locationId))
  const [error, setError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!locationId) {
      setRecap(null)
      setIsLoading(false)
      setError(null)
      return
    }
    let active = true
    setIsLoading(true)
    setError(null)
    acquisitionService
      .getRecapByLocation(locationId)
      .then((data) => {
        if (active) {
          setRecap(data)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat rekap pembebasan.')
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [locationId, reloadCount])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return { recap, isLoading, error, reload }
}
