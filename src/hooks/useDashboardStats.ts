import { useEffect, useState } from 'react'
import { dashboardService } from '../services/dashboardService'
import type { DashboardStats } from '../services/dashboardService'

interface DashboardState {
  stats: DashboardStats | null
  isLoading: boolean
  error: string | null
}

// Statistik dashboard §30 — satu RPC, satu call.
export function useDashboardStats(): DashboardState {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError(null)
    dashboardService
      .getStats()
      .then((data) => {
        if (active) {
          setStats(data)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat statistik.')
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  return { stats, isLoading, error }
}
