-- GadeSystem — migration: serah terima arsip (AGENTS.md §14)
-- Histori PERMANEN: hanya select + insert melalui API (RLS tanpa policy
-- update/delete) — koreksi hanya lewat SQL editor oleh admin.
--
-- Aturan status (ditegakkan RPC create_handover, atomik):
--   BERKAS_KELUAR  → arsip.status = DIPINJAM
--   BERKAS_KEMBALI → arsip.status = TERSEDIA
--   BERKAS_MASUK   → catatan saja, status tidak berubah
-- Nomor dibuat otomatis server-side (ST-YYYYMMDDHH24MISS-NNN).

create table if not exists public.handovers (
  id uuid primary key default gen_random_uuid(),
  nomor text not null unique,
  archive_id uuid not null references public.archives (id) on delete cascade,
  tanggal date not null,
  jenis text not null
    check (jenis in ('BERKAS_MASUK', 'BERKAS_KELUAR', 'BERKAS_KEMBALI')),
  dari text not null,
  kepada text not null,
  keperluan text,
  catatan text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.handovers is
  'Histori permanen serah terima arsip (AGENTS.md §14) — tidak dapat diedit/dihapus via API.';

create index if not exists handovers_archive_idx on public.handovers (archive_id);
create index if not exists handovers_jenis_idx on public.handovers (jenis);
create index if not exists handovers_created_at_idx on public.handovers (created_at desc);

-- RLS: histori permanen — hanya baca & tulis; TANPA policy update/delete.
alter table public.handovers enable row level security;

drop policy if exists "handovers_select_authenticated" on public.handovers;
create policy "handovers_select_authenticated"
  on public.handovers
  for select
  to authenticated
  using (true);

drop policy if exists "handovers_insert_authenticated" on public.handovers;
create policy "handovers_insert_authenticated"
  on public.handovers
  for insert
  to authenticated
  with check (true);

-- ============================================================
-- RPC create_handover: atomik — insert histori + ubah status arsip.
-- Invoker → RLS handovers/archives tetap berlaku.
-- ============================================================
create or replace function public.create_handover(
  p_archive_id uuid,
  p_jenis text,
  p_tanggal date,
  p_dari text,
  p_kepada text,
  p_keperluan text,
  p_catatan text
)
returns public.handovers
language plpgsql
as $$
declare
  v_row public.handovers;
begin
  if p_jenis not in ('BERKAS_MASUK', 'BERKAS_KELUAR', 'BERKAS_KEMBALI') then
    raise exception 'Jenis serah terima tidak dikenal.'
      using errcode = 'GDE10';
  end if;
  if coalesce(trim(p_dari), '') = '' or coalesce(trim(p_kepada), '') = '' then
    raise exception 'Kolom Dari dan Kepada wajib diisi.'
      using errcode = 'GDE11';
  end if;

  insert into public.handovers (
    nomor, archive_id, tanggal, jenis, dari, kepada, keperluan, catatan, created_by
  )
  values (
    'ST-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') || '-'
      || lpad((floor(random() * 1000))::int::text, 3, '0'),
    p_archive_id,
    coalesce(p_tanggal, current_date),
    p_jenis,
    trim(p_dari),
    trim(p_kepada),
    nullif(trim(p_keperluan), ''),
    nullif(trim(p_catatan), ''),
    auth.uid()
  )
  returning * into v_row;

  if p_jenis = 'BERKAS_KELUAR' then
    update public.archives set status = 'DIPINJAM' where id = p_archive_id;
  elsif p_jenis = 'BERKAS_KEMBALI' then
    update public.archives set status = 'TERSEDIA' where id = p_archive_id;
  end if;
  -- BERKAS_MASUK: hanya catat histori, status arsip tidak berubah.

  return v_row;
end;
$$;

comment on function public.create_handover(uuid, text, date, text, text, text, text) is
  'Catat serah terima atomik: insert histori + update status arsip (KELUAR→DIPINJAM, KEMBALI→TERSEDIA) (§14).';
