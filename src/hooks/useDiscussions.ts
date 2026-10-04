import { useCallback, useEffect, useState } from 'react'
import { discussionService } from '../services/discussionService'
import type { Paginated } from '../types/pagination'
import type { DiscussionDecision, DiscussionRecord } from '../types/discussion'

interface UseDiscussionsOptions {
  search: string
  keputusan: DiscussionDecision | null
  page: number
  pageSize?: number
}

interface ListState {
  result: Paginated<DiscussionRecord>
  isLoading: boolean
  error: string | null
}

// Daftar pembahasan dengan pencarian ter-debounce, filter keputusan, pagination.
export function useDiscussions({
  search,
  keputusan,
  page,
  pageSize = 20,
}: UseDiscussionsOptions): ListState {
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
    discussionService
      .list({ search: debouncedSearch, keputusan: keputusan ?? undefined, page, pageSize })
      .then((result) => {
        if (active) setState({ result, isLoading: false, error: null })
      })
      .catch((err) => {
        if (active) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Gagal memuat data pembahasan.',
          }))
        }
      })
    return () => {
      active = false
    }
  }, [debouncedSearch, keputusan, page, pageSize])

  return state
}

interface DetailState {
  discussion: DiscussionRecord | null
  isLoading: boolean
  error: string | null
}

// Detail satu pembahasan. Tanpa id (mode tambah) hook mengembalikan state kosong.
export function useDiscussionDetail(id: string | undefined): DetailState {
  const [state, setState] = useState<DetailState>({
    discussion: null,
    isLoading: Boolean(id),
    error: null,
  })

  useEffect(() => {
    if (!id) {
      setState({ discussion: null, isLoading: false, error: null })
      return
    }
    let active = true
    setState({ discussion: null, isLoading: true, error: null })
    discussionService
      .getById(id)
      .then((row) => {
        if (active) setState({ discussion: row, isLoading: false, error: null })
      })
      .catch((err) => {
        if (active) {
          setState({
            discussion: null,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Gagal memuat pembahasan.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [id])

  return state
}

interface HistoryState {
  discussions: DiscussionRecord[]
  isLoading: boolean
  error: string | null
  reload: () => void
}

// Histori pembahasan satu lokasi.
export function useDiscussionsByLocation(locationId: string | undefined): HistoryState {
  const [discussions, setDiscussions] = useState<DiscussionRecord[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(locationId))
  const [error, setError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!locationId) {
      setDiscussions([])
      setIsLoading(false)
      setError(null)
      return
    }
    let active = true
    setIsLoading(true)
    setError(null)
    discussionService
      .listHistoryByLocation(locationId)
      .then((rows) => {
        if (active) {
          setDiscussions(rows)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat histori pembahasan.')
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [locationId, reloadCount])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return { discussions, isLoading, error, reload }
}

// Histori pembahasan satu bidang.
export function useDiscussionsByParcel(parcelId: string | undefined): HistoryState {
  const [discussions, setDiscussions] = useState<DiscussionRecord[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(parcelId))
  const [error, setError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!parcelId) {
      setDiscussions([])
      setIsLoading(false)
      setError(null)
      return
    }
    let active = true
    setIsLoading(true)
    setError(null)
    discussionService
      .listHistoryByParcel(parcelId)
      .then((rows) => {
        if (active) {
          setDiscussions(rows)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat histori pembahasan.')
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [parcelId, reloadCount])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return { discussions, isLoading, error, reload }
}
