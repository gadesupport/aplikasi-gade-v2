import { useCallback, useEffect, useState } from 'react'
import { handoverService } from '../services/handoverService'
import type { HandoverListParams } from '../services/handoverService'
import type { Paginated } from '../types/pagination'
import type { HandoverRecord } from '../types/handover'

interface UseHandoversOptions {
  search: string
  jenis: HandoverListParams['jenis']
  page: number
  pageSize?: number
}

interface ListState {
  result: Paginated<HandoverRecord>
  isLoading: boolean
  error: string | null
}

// Daftar seluruh histori serah terima (halaman Serah Terima).
export function useHandovers({ search, jenis, page, pageSize = 20 }: UseHandoversOptions): ListState {
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
    handoverService
      .list({ search: debouncedSearch, jenis, page, pageSize })
      .then((result) => {
        if (active) setState({ result, isLoading: false, error: null })
      })
      .catch((err) => {
        if (active) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Gagal memuat histori serah terima.',
          }))
        }
      })
    return () => {
      active = false
    }
  }, [debouncedSearch, jenis, page, pageSize])

  return state
}

interface ByArchiveState {
  handovers: HandoverRecord[]
  isLoading: boolean
  error: string | null
  reload: () => void
}

// Histori serah terima satu arsip — section di halaman detail arsip.
export function useHandoversByArchive(archiveId: string | undefined): ByArchiveState {
  const [handovers, setHandovers] = useState<HandoverRecord[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(archiveId))
  const [error, setError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!archiveId) {
      setHandovers([])
      setIsLoading(false)
      setError(null)
      return
    }
    let active = true
    setIsLoading(true)
    setError(null)
    handoverService
      .listByArchive(archiveId)
      .then((rows) => {
        if (active) {
          setHandovers(rows)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat histori serah terima.')
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [archiveId, reloadCount])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return { handovers, isLoading, error, reload }
}
