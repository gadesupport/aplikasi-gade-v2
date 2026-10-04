-- GadeSystem — migration: projects (AGENTS.md §11)
-- Project entitas MANDIRI (tidak wajib berhubungan dengan bidang/lokasi):
-- untuk legal project, izin, dokumen project, dan arsip project.
-- Kolom "lokasi" adalah teks alamat lokasi project (bukan FK ke locations).
--
-- Kode format PRJ-YYYY-NNN ditegakkan regex di database DAN service.
-- Status tidak dispesifikkan AGENTS.md §11 → set umum: PERENCANAAN,
-- BERJALAN, SELESAI, DIBATALKAN (ubah via migration bila berbeda kebutuhan).

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique
    check (kode ~ '^PRJ-[0-9]{4}-[0-9]{3}$'),
  nama text not null,
  lokasi text,
  desa text,
  kecamatan text,
  kabupaten text,
  status text not null default 'PERENCANAAN'
    check (status in ('PERENCANAAN', 'BERJALAN', 'SELESAI', 'DIBATALKAN')),
  keterangan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.projects is
  'Project mandiri untuk legal project, izin, dan arsip project (AGENTS.md §11).';

create index if not exists projects_status_idx on public.projects (status);
create index if not exists projects_kabupaten_idx on public.projects (kabupaten);
create index if not exists projects_created_at_idx on public.projects (created_at desc);

create or replace trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute function public.set_updated_at();

-- RLS: pola master data — baca/tulis untuk semua user terautentikasi,
-- hapus hanya ADMIN/SUPERADMIN.
alter table public.projects enable row level security;

drop policy if exists "projects_select_authenticated" on public.projects;
create policy "projects_select_authenticated"
  on public.projects
  for select
  to authenticated
  using (true);

drop policy if exists "projects_insert_authenticated" on public.projects;
create policy "projects_insert_authenticated"
  on public.projects
  for insert
  to authenticated
  with check (true);

drop policy if exists "projects_update_authenticated" on public.projects;
create policy "projects_update_authenticated"
  on public.projects
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "projects_delete_admin" on public.projects;
create policy "projects_delete_admin"
  on public.projects
  for delete
  to authenticated
  using (public.is_admin());
