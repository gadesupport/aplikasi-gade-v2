import { useCallback, useEffect, useState } from 'react'
import { documentService } from '../services/documentService'
import type { ArchiveDocumentRecord } from '../types/archiveDocument'

interface ArchiveDocumentsState {
  documents: ArchiveDocumentRecord[]
  isLoading: boolean
  error: string | null
  reload: () => void
}

// Dokumen digital satu arsip; reload() dipanggil setelah upload/delete.
export function useArchiveDocuments(archiveId: string | undefined): ArchiveDocumentsState {
  const [documents, setDocuments] = useState<ArchiveDocumentRecord[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(archiveId))
  const [error, setError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!archiveId) {
      setDocuments([])
      setIsLoading(false)
      setError(null)
      return
    }
    let active = true
    setIsLoading(true)
    setError(null)
    documentService
      .listByArchive(archiveId)
      .then((rows) => {
        if (active) {
          setDocuments(rows)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat dokumen.')
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [archiveId, reloadCount])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return { documents, isLoading, error, reload }
}
