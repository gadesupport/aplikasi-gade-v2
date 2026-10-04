-- GadeSystem — migration: role permissions per menu (pengaturan akses)
-- Matriks role × menu × aksi (view/create/update/delete).
-- Enforcement utama tetap RLS; tabel ini mengatur apa yang terlihat
-- dan dapat dioperasikan per role di aplikasi.

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null
    check (role in ('SUPERADMIN', 'ADMIN', 'SURVEYOR', 'LEGAL')),
  menu_path text not null,
  can_view boolean not null default true,
  can_create boolean not null default false,
  can_update boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role, menu_path)
);

comment on table public.role_permissions is
  'Matriks akses role terhadap menu dan CRUD (menu Pengaturan).';

create index if not exists role_permissions_role_idx on public.role_permissions (role);

create or replace trigger role_permissions_set_updated_at
  before update on public.role_permissions
  for each row
  execute function public.set_updated_at();

-- RLS: semua user terautentikasi membaca (sidebar perlu); ubah hanya SUPERADMIN.
alter table public.role_permissions enable row level security;

drop policy if exists "role_permissions_select_authenticated" on public.role_permissions;
create policy "role_permissions_select_authenticated"
  on public.role_permissions
  for select
  to authenticated
  using (true);

drop policy if exists "role_permissions_write_superadmin" on public.role_permissions;
create policy "role_permissions_write_superadmin"
  on public.role_permissions
  for insert
  to authenticated
  with check (public.is_superadmin());

drop policy if exists "role_permissions_update_superadmin" on public.role_permissions;
create policy "role_permissions_update_superadmin"
  on public.role_permissions
  for update
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

drop policy if exists "role_permissions_delete_superadmin" on public.role_permissions;
create policy "role_permissions_delete_superadmin"
  on public.role_permissions
  for delete
  to authenticated
  using (public.is_superadmin());

-- ============================================================
-- Seed default (on conflict do nothing — tidak menimpa penyesuaian)
-- ============================================================
insert into public.role_permissions (role, menu_path, can_view, can_create, can_update, can_delete)
select
  r.role,
  m.menu_path,
  -- can_view
  case
    when r.role in ('SUPERADMIN', 'ADMIN') then true
    when r.role = 'SURVEYOR' then m.menu_path not in ('/legalitas', '/pembebasan', '/project', '/audit-log')
    when r.role = 'LEGAL' then m.menu_path not in ('/project', '/pembebasan', '/audit-log', '/serah-terima')
  end,
  -- can_create
  case
    when r.role = 'SUPERADMIN' then m.menu_path in ('/lokasi','/bidang','/pihak','/project','/survey','/pembahasan','/legalitas','/pembebasan','/arsip','/serah-terima')
    when r.role = 'ADMIN' then m.menu_path in ('/lokasi','/bidang','/pihak','/project','/survey','/pembahasan','/legalitas','/pembebasan','/arsip','/serah-terima')
    when r.role = 'SURVEYOR' then m.menu_path in ('/lokasi','/bidang','/survey','/pembahasan','/serah-terima')
    when r.role = 'LEGAL' then m.menu_path in ('/legalitas','/survey','/arsip')
  end,
  -- can_update
  case
    when r.role = 'SUPERADMIN' then m.menu_path in ('/lokasi','/bidang','/pihak','/project','/survey','/pembahasan','/legalitas','/pembebasan','/arsip','/serah-terima')
    when r.role = 'ADMIN' then m.menu_path in ('/lokasi','/bidang','/pihak','/project','/survey','/pembahasan','/legalitas','/pembebasan','/arsip','/serah-terima')
    when r.role = 'SURVEYOR' then m.menu_path in ('/lokasi','/bidang','/survey','/pembahasan')
    when r.role = 'LEGAL' then m.menu_path in ('/legalitas','/survey','/arsip')
  end,
  -- can_delete
  case
    when r.role = 'SUPERADMIN' then m.menu_path in ('/lokasi','/bidang','/pihak','/project','/survey','/pembahasan','/legalitas','/pembebasan','/arsip','/serah-terima')
    when r.role = 'ADMIN' then m.menu_path in ('/lokasi','/bidang','/pihak','/project','/survey','/pembahasan','/legalitas','/pembebasan','/arsip','/serah-terima')
    when r.role = 'SURVEYOR' then m.menu_path in ('/survey','/pembahasan')
    when r.role = 'LEGAL' then m.menu_path in ('/legalitas')
  end
from (values ('SUPERADMIN'), ('ADMIN'), ('SURVEYOR'), ('LEGAL')) as r(role)
cross join (
  values ('/dashboard'), ('/lokasi'), ('/bidang'), ('/pihak'), ('/project'),
         ('/survey'), ('/pembahasan'), ('/legalitas'), ('/pembebasan'), ('/arsip'),
         ('/serah-terima'), ('/peta'), ('/laporan'), ('/audit-log'), ('/pengaturan')
) as m(menu_path)
on conflict (role, menu_path) do nothing;
