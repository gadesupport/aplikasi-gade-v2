import { ServiceError, toServiceError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { requireSupabase, unwrapQuery } from './query'
import { auditService } from './auditService'
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
} from '../types/archiveDocument'
import type { ArchiveDocumentRecord } from '../types/archiveDocument'

const BUCKET = 'archive-documents'
const COLUMNS = 'id, archive_id, file_name, storage_path, mime_type, file_size, uploaded_by, uploaded_at'
const SIGNED_URL_EXPIRY_SECONDS = 300

// Karakter aman untuk path Storage; nama asli tetap tersimpan di file_name.
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
}

// Validasi client-side (UX); aturan yang sama ditegakkan storage policy
// (ekstensi + ukuran) dan CHECK tabel (mime + ukuran).
function validateFile(file: File): void {
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new ServiceError('Tipe file tidak diizinkan. Hanya PDF, JPG, JPEG, dan PNG.')
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ServiceError(`Ukuran file maksimal ${MAX_FILE_SIZE_MB} MB.`)
  }
  if (file.size <= 0) {
    throw new ServiceError('File kosong atau tidak terbaca.')
  }
}

export const documentService = {
  async listByArchive(archiveId: string): Promise<ArchiveDocumentRecord[]> {
    requireSupabase()
    return (
      (await unwrapQuery<ArchiveDocumentRecord[]>(
        supabase
          .from('archive_documents')
          .select(COLUMNS)
          .eq('archive_id', archiveId)
          .order('uploaded_at', { ascending: false }),
      )) ?? []
    )
  },

  // Upload ke bucket privat lalu simpan metadata. Bila penyimpanan metadata
  // gagal, file yang baru terunggah dihapus kembali (tidak ada file yatim).
  async upload(archiveId: string, file: File): Promise<ArchiveDocumentRecord> {
    requireSupabase()
    validateFile(file)
    const storagePath = `${archiveId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false })
    if (uploadError) throw toServiceError(uploadError)

    const { data: userData } = await supabase.auth.getUser()
    const { data: row, error: insertError } = await supabase
      .from('archive_documents')
      .insert({
        archive_id: archiveId,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        file_size: file.size,
        uploaded_by: userData.user?.id ?? null,
      })
      .select(COLUMNS)
      .single()

    if (insertError) {
      await supabase.storage.from(BUCKET).remove([storagePath])
      throw toServiceError(insertError)
    }
    const record = row as ArchiveDocumentRecord
    auditService.log('UPLOAD', 'ARCHIVE_DOCUMENT', record.id, record.file_name)
    return record
  },

  // Bucket privat → unduhan lewat signed URL berumur pendek.
  async getDownloadUrl(documentId: string): Promise<string> {
    requireSupabase()
    const row = await unwrapQuery<ArchiveDocumentRecord | null>(
      supabase.from('archive_documents').select(COLUMNS).eq('id', documentId).maybeSingle(),
    )
    if (!row) {
      throw new ServiceError('Dokumen tidak ditemukan.', { code: 'DOCUMENT_NOT_FOUND' })
    }
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, SIGNED_URL_EXPIRY_SECONDS)
    if (error) throw toServiceError(error)
    if (!data?.signedUrl) {
      throw new ServiceError('Gagal membuat tautan unduhan.')
    }
    auditService.log('DOWNLOAD', 'ARCHIVE_DOCUMENT', row.id, row.file_name)
    return data.signedUrl
  },

  // Hapus file Storage dulu, baru metadata — baris tidak menunjuk file hilang.
  async remove(documentId: string): Promise<void> {
    requireSupabase()
    const row = await unwrapQuery<ArchiveDocumentRecord | null>(
      supabase.from('archive_documents').select(COLUMNS).eq('id', documentId).maybeSingle(),
    )
    if (!row) {
      throw new ServiceError('Dokumen tidak ditemukan.', { code: 'DOCUMENT_NOT_FOUND' })
    }
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([row.storage_path])
    if (storageError) throw toServiceError(storageError)
    const { error: deleteError } = await supabase
      .from('archive_documents')
      .delete()
      .eq('id', documentId)
    if (deleteError) throw toServiceError(deleteError)
    auditService.log('DELETE', 'ARCHIVE_DOCUMENT', documentId, row.file_name)
  },
}
