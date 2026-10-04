import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useArchiveDocuments } from '../hooks/useArchiveDocuments'
import { formatDateTime, formatFileSize } from '../lib/format'
import { documentService } from '../services/documentService'
import { MAX_FILE_SIZE_MB } from '../types/archiveDocument'
import type { ArchiveDocumentRecord } from '../types/archiveDocument'

const MIME_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
}

// Section "Dokumen Digital" pada halaman detail arsip (§13): upload
// (PDF/JPG/JPEG/PNG, maks 20 MB, bucket privat), daftar dokumen,
// unduh via signed URL, dan hapus.
export default function ArchiveDocumentsSection({ archiveId }: { archiveId: string }) {
  const { documents, isLoading, error, reload } = useArchiveDocuments(archiveId)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setIsUploading(true)
    setActionError(null)
    try {
      await documentService.upload(archiveId, file)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal mengunggah dokumen.')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDownload(doc: ArchiveDocumentRecord) {
    setBusyId(doc.id)
    setActionError(null)
    try {
      const url = await documentService.getDownloadUrl(doc.id)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal membuka dokumen.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(doc: ArchiveDocumentRecord) {
    const confirmed = window.confirm(`Hapus dokumen "${doc.file_name}"?\nFile juga dihapus dari penyimpanan.`)
    if (!confirmed) return
    setBusyId(doc.id)
    setActionError(null)
    try {
      await documentService.remove(doc.id)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menghapus dokumen.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">
          Dokumen Digital ({documents.length})
        </h2>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(event) => void handleFileChange(event)}
            className="hidden"
            id="document-upload"
            disabled={isUploading}
          />
          <label
            htmlFor="document-upload"
            className={`inline-flex cursor-pointer rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 ${
              isUploading ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            {isUploading ? 'Mengunggah…' : '+ Unggah Dokumen'}
          </label>
        </div>
      </div>

      {actionError && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {error ? (
        <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-3 p-10 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
          Memuat dokumen…
        </div>
      ) : documents.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm font-medium text-slate-700">Belum ada dokumen digital.</p>
          <p className="mt-1 text-sm text-slate-500">
            Unggah PDF/JPG/JPEG/PNG (maks {MAX_FILE_SIZE_MB} MB) untuk arsip ini.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{doc.file_name}</p>
                <p className="text-xs text-slate-500">
                  {MIME_LABELS[doc.mime_type] ?? doc.mime_type} · {formatFileSize(doc.file_size)} ·{' '}
                  {formatDateTime(doc.uploaded_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleDownload(doc)}
                  disabled={busyId === doc.id}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyId === doc.id ? 'Memproses…' : 'Unduh'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(doc)}
                  disabled={busyId === doc.id}
                  className="text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-slate-100 px-6 py-3 text-xs text-slate-400">
        Tipe diizinkan: PDF, JPG, JPEG, PNG — maksimal {MAX_FILE_SIZE_MB} MB per file. File
        tersimpan di bucket privat; unduhan memakai tautan bertanda tangan berumur pendek.
      </p>
    </div>
  )
}
