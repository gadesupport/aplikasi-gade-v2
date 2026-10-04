-- GadeSystem — migration: pembahasan (AGENTS.md §9)
-- Pembahasan terkait LOKASI dan/atau BIDANG (minimal satu — CHECK).
-- Simpan histori: satu baris per pembahasan; target 1:N pembahasan.
-- Efek keputusan (ditegakkan RPC create/update, atomik):
--   TIDAK_LAYAK   → status target menjadi DITOLAK
--   PERLU_KAJIAN  → status target menjadi DITUNDA
--   LAYAK         → tidak mengubah status

create table if not exists public.discussions (
  id uuid primary key default gen_random_uuid(),
  lokasi_id uuid references public.locations (id) on delete cascade,
  bidang_id uuid references public.land_parcels (id) on delete cascade,
  tanggal date not null,
  peserta text not null,
  hasil text not null,
  keputusan text not null
    check (keputusan in ('LAYAK', 'PERLU_KAJIAN', 'TIDAK_LAYAK')),
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint discussions_target_required
    check (lokasi_id is not null or bidang_id is not null)
);

comment on table public.discussions is
  'Pembahasan lokasi/bidang + keputusan; efek status via RPC (§9).';

create index if not exists discussions_lokasi_idx on public.discussions (lokasi_id);
create index if not exists discussions_bidang_idx on public.discussions (bidang_id);
create index if not exists discussions_tanggal_idx on public.discussions (tanggal desc);
create index if not exists discussions_keputusan_idx on public.discussions (keputusan);

create or replace trigger discussions_set_updated_at
  before update on public.discussions
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- Efek keputusan → status target (dipanggil RPC create/update)
-- ============================================================
create or replace function public.apply_discussion_decision(
  p_lokasi_id uuid,
  p_bidang_id uuid,
  p_keputusan text
)
returns void
language plpgsql
as $$
begin
  if p_keputusan not in ('TIDAK_LAYAK', 'PERLU_KAJIAN') then
    return; -- LAYAK: tidak mengubah status
  end if;
  if p_lokasi_id is not null then
    update public.locations
    set status = case when p_keputusan = 'TIDAK_LAYAK' then 'DITOLAK' else 'DITUNDA' end
    where id = p_lokasi_id;
  elsif p_bidang_id is not null then
    update public.land_parcels
    set status_pembebasan = case when p_keputusan = 'TIDAK_LAYAK' then 'DITOLAK' else 'DITUNDA' end
    where id = p_bidang_id;
  end if;
end;
$$;

-- ============================================================
-- RPC create/update pembahasan (atomik + efek status).
-- Invoker → RLS tetap berlaku. SQLSTATE kustom:
--   GDE12 target tidak valid / tidak ditemukan
--   GDE13 keputusan tidak dikenal
-- ============================================================
create or replace function public.create_pembahasan(
  p_lokasi_id uuid,
  p_bidang_id uuid,
  p_tanggal date,
  p_peserta text,
  p_hasil text,
  p_keputusan text,
  p_catatan text
)
returns public.discussions
language plpgsql
as $$
declare
  v_row public.discussions;
begin
  if p_keputusan not in ('LAYAK', 'PERLU_KAJIAN', 'TIDAK_LAYAK') then
    raise exception 'Keputusan tidak dikenal.' using errcode = 'GDE13';
  end if;
  if (p_lokasi_id is null) = (p_bidang_id is null) then
    raise exception 'Pilih salah satu target: lokasi ATAU bidang.'
      using errcode = 'GDE12';
  end if;

  insert into public.discussions (
    lokasi_id, bidang_id, tanggal, peserta, hasil, keputusan, catatan
  )
  values (
    p_lokasi_id, p_bidang_id, coalesce(p_tanggal, current_date),
    coalesce(trim(p_peserta), ''), coalesce(trim(p_hasil), ''),
    p_keputusan, nullif(trim(p_catatan), '')
  )
  returning * into v_row;

  perform public.apply_discussion_decision(v_row.lokasi_id, v_row.bidang_id, v_row.keputusan);

  return v_row;
end;
$$;

create or replace function public.update_pembahasan(
  p_id uuid,
  p_tanggal date,
  p_peserta text,
  p_hasil text,
  p_keputusan text,
  p_catatan text
)
returns public.discussions
language plpgsql
as $$
declare
  v_row public.discussions;
begin
  if p_keputusan not in ('LAYAK', 'PERLU_KAJIAN', 'TIDAK_LAYAK') then
    raise exception 'Keputusan tidak dikenal.' using errcode = 'GDE13';
  end if;

  update public.discussions
  set tanggal = coalesce(p_tanggal, tanggal),
      peserta = coalesce(trim(p_peserta), peserta),
      hasil = coalesce(trim(p_hasil), hasil),
      keputusan = p_keputusan,
      catatan = nullif(trim(p_catatan), '')
  where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Pembahasan tidak ditemukan.' using errcode = 'P0002';
  end if;

  perform public.apply_discussion_decision(v_row.lokasi_id, v_row.bidang_id, v_row.keputusan);

  return v_row;
end;
$$;

-- ============================================================
-- RLS: data alur kerja — semua operasi untuk user terautentikasi.
-- ============================================================
alter table public.discussions enable row level security;

drop policy if exists "discussions_select_authenticated" on public.discussions;
create policy "discussions_select_authenticated"
  on public.discussions
  for select
  to authenticated
  using (true);

drop policy if exists "discussions_insert_authenticated" on public.discussions;
create policy "discussions_insert_authenticated"
  on public.discussions
  for insert
  to authenticated
  with check (true);

drop policy if exists "discussions_update_authenticated" on public.discussions;
create policy "discussions_update_authenticated"
  on public.discussions
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "discussions_delete_authenticated" on public.discussions;
create policy "discussions_delete_authenticated"
  on public.discussions
  for delete
  to authenticated
  using (true);
