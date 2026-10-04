// Batas & tipe yang diizinkan — SINKRON dengan migration
// 20260917000013_create_archive_documents.sql (storage policy + CHECK).
export const MAX_FILE_SIZE_MB = 20
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

// Baris tabel public.archive_documents — metadata dokumen digital;
// file fisik tersimpan di bucket privat Supabase Storage.
export interface ArchiveDocumentRecord {
  id: string
  archive_id: string
  file_name: string
  storage_path: string
  mime_type: AllowedMimeType
  file_size: number
  uploaded_by: string | null
  uploaded_at: string
}
