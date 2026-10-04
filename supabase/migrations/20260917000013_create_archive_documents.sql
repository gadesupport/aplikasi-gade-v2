-- GadeSystem — migration: dokumen digital arsip (AGENTS.md §13)
-- Bucket privat Supabase Storage + tabel metadata archive_documents.
-- File TIDAK disimpan sebagai base64 di database (§13) — hanya metadata;
-- file fisik ada di Storage private bucket "archive-documents".

-- Batas 20 MB = 20_971_520 byte (sinkron dengan documentService).
-- Ekstensi diizinkan: pdf, jpg, jpeg, png (sinkron dengan service).

-- ============================================================
-- 1. Private bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('archive-documents', 'archive-documents', false)
on conflict (id) do nothing;

-- ============================================================
-- 2. Storage policies (RLS storage.objects) — bucket privat:
--    hanya user terautentikasi; insert divalidasi ekstensi + ukuran.
-- ============================================================
drop policy if exists "archive_documents_storage_select" on storage.objects;
create policy "archive_documents_storage_select"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'archive-documents');

drop policy if exists "archive_documents_storage_insert" on storage.objects;
create policy "archive_documents_storage_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'archive-documents'
    and ((metadata ->> 'size')::bigint) <= 20971520
    and storage.extension(name) in ('pdf', 'jpg', 'jpeg', 'png')
  );

drop policy if exists "archive_documents_storage_delete" on storage.objects;
create policy "archive_documents_storage_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'archive-documents');

-- ============================================================
-- 3. Tabel metadata
-- ============================================================
create table if not exists public.archive_documents (
  id uuid primary key default gen_random_uuid(),
  archive_id uuid not null references public.archives (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text not null
    check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size bigint not null
    check (file_size > 0 and file_size <= 20971520),
  uploaded_by uuid references auth.users (id) on delete set null,
  uploaded_at timestamptz not null default now()
);

comment on table public.archive_documents is
  'Metadata dokumen digital arsip — file tersimpan di Storage bucket privat (AGENTS.md §13).';

create index if not exists archive_documents_archive_idx on public.archive_documents (archive_id);
create index if not exists archive_documents_uploaded_at_idx on public.archive_documents (uploaded_at desc);

-- RLS: dokumen bagian alur kerja arsip — baca/tambah/hapus untuk user
-- terautentikasi (selaras storage policies).
alter table public.archive_documents enable row level security;

drop policy if exists "archive_documents_select_authenticated" on public.archive_documents;
create policy "archive_documents_select_authenticated"
  on public.archive_documents
  for select
  to authenticated
  using (true);

drop policy if exists "archive_documents_insert_authenticated" on public.archive_documents;
create policy "archive_documents_insert_authenticated"
  on public.archive_documents
  for insert
  to authenticated
  with check (true);

drop policy if exists "archive_documents_delete_authenticated" on public.archive_documents;
create policy "archive_documents_delete_authenticated"
  on public.archive_documents
  for delete
  to authenticated
  using (true);
