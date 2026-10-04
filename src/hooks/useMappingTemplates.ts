import { useCallback, useEffect, useState } from 'react'
import { gisTemplateService } from '../services/gisTemplateService'
import type { MappingTemplate } from '../services/gisTemplateService'

interface MappingTemplatesState {
  templates: MappingTemplate[]
  isLoading: boolean
  error: string | null
  reload: () => void
}

// Daftar template field mapping import GIS (§24).
export function useMappingTemplates(): MappingTemplatesState {
  const [templates, setTemplates] = useState<MappingTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError(null)
    gisTemplateService
      .list()
      .then((rows) => {
        if (active) {
          setTemplates(rows)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat template.')
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [reloadCount])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return { templates, isLoading, error, reload }
}
