-- GadeSystem — migration: profiles + RLS
-- Terapkan via Supabase Dashboard (SQL Editor) atau Supabase CLI (supabase db push).
-- Password/identitas tetap dikelola Supabase Auth — tabel ini hanya profil (nama, role).

-- ============================================================
-- 1. Trigger updated_at generik (dipakai ulang tabel lain nanti)
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 2. Tabel profiles
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nama text not null default '',
  role text not null default 'ADMIN'
    check (role in ('SUPERADMIN', 'ADMIN', 'SURVEYOR', 'LEGAL')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Profil pengguna GadeSystem (1:1 dengan auth.users).';

create index if not exists profiles_role_idx on public.profiles (role);

create or replace trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- 3. Helper: apakah pelaku SUPERADMIN
--    (security definer → query internal tidak kena RLS → bebas rekursi policy)
-- ============================================================
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'SUPERADMIN'
  )
$$;

-- ============================================================
-- 4. Profil otomatis untuk setiap user baru (dashboard maupun signup)
--    User pertama = SUPERADMIN, selanjutnya ADMIN
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nama, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nama', split_part(coalesce(new.email, 'pengguna'), '@', 1)),
    case
      when not exists (select 1 from public.profiles) then 'SUPERADMIN'
      else 'ADMIN'
    end
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================
-- 5. RLS profiles
-- ============================================================
alter table public.profiles enable row level security;

-- Baca: semua user terautentikasi (nama/role dipakai UI).
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

-- Update baris sendiri (mis. ubah nama sendiri).
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Update semua baris khusus SUPERADMIN (kelola role user lain).
drop policy if exists "profiles_update_superadmin" on public.profiles;
create policy "profiles_update_superadmin"
  on public.profiles
  for update
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Tidak ada policy insert/delete:
-- - insert hanya lewat trigger handle_new_user (security definer)
-- - delete mengikuti auth.users (on delete cascade), oleh admin

-- ============================================================
-- 6. Guard: hanya SUPERADMIN yang boleh mengubah role via REST API
--    (akses admin tanpa JWT — service_role / SQL editor — tetap lolos)
-- ============================================================
create or replace function public.guard_profiles_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
    and auth.uid() is not null
    and not public.is_superadmin()
  then
    raise exception 'Hanya SUPERADMIN yang boleh mengubah role.';
  end if;
  return new;
end;
$$;

create or replace trigger profiles_guard_role
  before update on public.profiles
  for each row
  execute function public.guard_profiles_role();
