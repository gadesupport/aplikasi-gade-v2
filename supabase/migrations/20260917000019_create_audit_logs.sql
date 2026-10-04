-- GadeSystem — migration: audit log (AGENTS.md §16)
-- Append-only: insert oleh user terautentikasi (via service layer),
-- SELECT hanya untuk SUPERADMIN, TANPA update/delete (permanen).
-- user_id terisi otomatis dari sesi (DEFAULT auth.uid()).

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete set null,
  action text not null
    check (action in (
      'LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'UPLOAD', 'DOWNLOAD',
      'HANDOVER', 'STATUS_CHANGE', 'GIS_IMPORT', 'GIS_EXPORT', 'GEOMETRY_CHANGE'
    )),
  entity text not null,
  entity_id text,
  description text,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is
  'Audit log append-only (§16) — tulis oleh authenticated, baca hanya SUPERADMIN.';

create index if not exists audit_logs_user_idx on public.audit_logs (user_id);
create index if not exists audit_logs_action_idx on public.audit_logs (action);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- RLS: permanen — hanya baca (SUPERADMIN) & tulis (authenticated).
alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_insert_authenticated" on public.audit_logs;
create policy "audit_logs_insert_authenticated"
  on public.audit_logs
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "audit_logs_select_superadmin" on public.audit_logs;
create policy "audit_logs_select_superadmin"
  on public.audit_logs
  for select
  to authenticated
  using (public.is_superadmin());

-- Tidak ada policy update/delete → tidak dapat diubah/dihapus via API.
