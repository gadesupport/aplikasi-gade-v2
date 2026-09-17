import { useCallback, useEffect, useState } from 'react'
import { legalityService } from '../services/legalityService'
import type { LegalityRecord } from '../types/legality'

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
