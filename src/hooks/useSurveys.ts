import { useCallback, useEffect, useState } from 'react'
import { surveyService } from '../services/surveyService'
import type { SurveyListParams } from '../services/surveyService'
import type { Paginated } from '../types/pagination'
import type { SurveyRecord } from '../types/survey'

interface UseSurveysOptions {
  search: string
  lokasiId: string | null
  page: number
  pageSize?: number
}

interface ListState {
  result: Paginated<SurveyRecord>
  isLoading: boolean
  error: string | null
}

// Daftar survey dengan pencarian ter-debounce, filter lokasi, pagination.
export function useSurveys({ search, lokasiId, page, pageSize = 20 }: UseSurveysOptions): ListState {
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
    surveyService
      .list({ search: debouncedSearch, lokasiId: lokasiId ?? undefined, page, pageSize })
      .then((result) => {
        if (active) setState({ result, isLoading: false, error: null })
      })
      .catch((err) => {
        if (active) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Gagal memuat data survey.',
          }))
        }
      })
    return () => {
      active = false
    }
  }, [debouncedSearch, lokasiId, page, pageSize])

  return state
}

interface DetailState {
  survey: SurveyRecord | null
  isLoading: boolean
  error: string | null
}

// Detail satu survey. Tanpa id (mode tambah) hook mengembalikan state kosong.
export function useSurveyDetail(id: string | undefined): DetailState {
  const [state, setState] = useState<DetailState>({
    survey: null,
    isLoading: Boolean(id),
    error: null,
  })

  useEffect(() => {
    if (!id) {
      setState({ survey: null, isLoading: false, error: null })
      return
    }
    let active = true
    setState({ survey: null, isLoading: true, error: null })
    surveyService
      .getById(id)
      .then((survey) => {
        if (active) setState({ survey, isLoading: false, error: null })
      })
      .catch((err) => {
        if (active) {
          setState({
            survey: null,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Gagal memuat survey.',
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
  surveys: SurveyRecord[]
  isLoading: boolean
  error: string | null
  reload: () => void
}

// Histori survey satu lokasi (survey yang menarget lokasi tersebut).
export function useSurveysByLocation(locationId: string | undefined): HistoryState {
  const [surveys, setSurveys] = useState<SurveyRecord[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(locationId))
  const [error, setError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!locationId) {
      setSurveys([])
      setIsLoading(false)
      setError(null)
      return
    }
    let active = true
    setIsLoading(true)
    setError(null)
    surveyService
      .listHistoryByLocation(locationId)
      .then((rows) => {
        if (active) {
          setSurveys(rows)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat histori survey.')
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [locationId, reloadCount])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return { surveys, isLoading, error, reload }
}

// Histori survey satu bidang.
export function useSurveysByParcel(parcelId: string | undefined): HistoryState {
  const [surveys, setSurveys] = useState<SurveyRecord[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(parcelId))
  const [error, setError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!parcelId) {
      setSurveys([])
      setIsLoading(false)
      setError(null)
      return
    }
    let active = true
    setIsLoading(true)
    setError(null)
    surveyService
      .listHistoryByParcel(parcelId)
      .then((rows) => {
        if (active) {
          setSurveys(rows)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat histori survey.')
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [parcelId, reloadCount])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return { surveys, isLoading, error, reload }
}

export type { SurveyListParams }
