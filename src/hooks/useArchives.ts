import { useCallback, useEffect, useState } from 'react'
import { archiveService } from '../services/archiveService'
import type { Paginated } from '../types/pagination'
import type { ArchiveRecord, ArchiveRelationType, ArchiveStatus } from '../types/archive'

interface UseArchivesOptions {
  search: string
  tipeRelasi: ArchiveRelationType | null
  status: ArchiveStatus | null
  page: number
  pageSize?: number
}

interface ListState {
  result: Paginated<ArchiveRecord>
  isLoading: boolean
  error: string | null
}

// Daftar arsip dengan pencarian ter-debounce 300ms, filter tipe relasi &
// status, dan pagination.
export function useArchives({
  search,
  tipeRelasi,
  status,
  page,
  pageSize = 20,
}: UseArchivesOptions): ListState {
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
    archiveService
      .list({
        search: debouncedSearch,
        tipeRelasi: tipeRelasi ?? undefined,
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
            error: err instanceof Error ? err.message : 'Gagal memuat data arsip.',
          }))
        }
      })
    return () => {
      active = false
    }
  }, [debouncedSearch, tipeRelasi, status, page, pageSize])

  return state
}

interface DetailState {
  archive: ArchiveRecord | null
  isLoading: boolean
  error: string | null
  reload: () => void
}

// Detail satu arsip. Tanpa id (mode tambah) hook mengembalikan state kosong.
// reload() dipakai setelah serah terima mengubah status arsip.
export function useArchiveDetail(id: string | undefined): DetailState {
  const [archive, setArchive] = useState<ArchiveRecord | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(id))
  const [error, setError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!id) {
      setArchive(null)
      setIsLoading(false)
      setError(null)
      return
    }
    let active = true
    setArchive(null)
    setIsLoading(true)
    setError(null)
    archiveService
      .getById(id)
      .then((row) => {
        if (active) {
          setArchive(row)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setArchive(null)
          setIsLoading(false)
          setError(err instanceof Error ? err.message : 'Gagal memuat arsip.')
        }
      })
    return () => {
      active = false
    }
  }, [id, reloadCount])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return { archive, isLoading, error, reload }
}
