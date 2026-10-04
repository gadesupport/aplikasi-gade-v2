import { useEffect, useState } from 'react'
import { projectService } from '../services/projectService'
import type { Paginated } from '../types/pagination'
import type { ProjectRecord, ProjectStatus } from '../types/project'

interface UseProjectsOptions {
  search: string
  status: ProjectStatus | null
  page: number
  pageSize?: number
}

interface ListState {
  result: Paginated<ProjectRecord>
  isLoading: boolean
  error: string | null
}

// Daftar project dengan pencarian ter-debounce 300ms, filter status,
// dan pagination.
export function useProjects({ search, status, page, pageSize = 20 }: UseProjectsOptions): ListState {
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
    projectService
      .list({ search: debouncedSearch, status: status ?? undefined, page, pageSize })
      .then((result) => {
        if (active) setState({ result, isLoading: false, error: null })
      })
      .catch((err) => {
        if (active) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Gagal memuat data project.',
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
  project: ProjectRecord | null
  isLoading: boolean
  error: string | null
}

// Detail satu project. Tanpa id (mode tambah) hook mengembalikan state kosong.
export function useProjectDetail(id: string | undefined): DetailState {
  const [state, setState] = useState<DetailState>({
    project: null,
    isLoading: Boolean(id),
    error: null,
  })

  useEffect(() => {
    if (!id) {
      setState({ project: null, isLoading: false, error: null })
      return
    }
    let active = true
    setState({ project: null, isLoading: true, error: null })
    projectService
      .getById(id)
      .then((project) => {
        if (active) setState({ project, isLoading: false, error: null })
      })
      .catch((err) => {
        if (active) {
          setState({
            project: null,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Gagal memuat project.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [id])

  return state
}
