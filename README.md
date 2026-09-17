# GadeSystem — Garda Depan Pertanahan

Aplikasi web internal Tim Gade untuk mengelola survey lokasi, pembahasan, bidang tanah, pihak/pemilik, legalitas, proses pembebasan, project, arsip, dokumen digital, serah terima, monitoring, laporan, audit, dan peta/GIS pertanahan.

Lihat `AGENTS.md` untuk spesifikasi lengkap.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS + React Router
- **Peta:** Leaflet + Leaflet-Geoman (free) — komponen reusable `src/components/MapView.tsx` (tampil, zoom, pan, marker, GeoJSON layer; basemap OpenStreetMap). Toolbar editing belum diaktifkan — menyusul di modul Peta (AGENTS.md §17).
- **Backend/Data:** Supabase (Auth, PostgreSQL + PostGIS, Storage) — diakses hanya melalui service layer

## Menjalankan Development

```bash
npm install
copy .env.example .env   # isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
npm run dev
```

Tanpa `.env`, aplikasi tetap berjalan dan halaman login menampilkan peringatan bahwa Supabase belum dikonfigurasi.

## Script

| Script | Fungsi |
| --- | --- |
| `npm run dev` | Development server (Vite) |
| `npm run build` | Typecheck (`tsc --noEmit`) + production build |
| `npm run typecheck` | Cek TypeScript saja |
| `npm run preview` | Preview hasil build |

## Struktur Folder

```
src/
  components/   # Komponen UI reusable (layout, sidebar, header, placeholder)
  pages/        # Halaman per route
  services/     # Service layer — semua akses Supabase lewat sini
  hooks/        # Custom hooks (auth, dll.)
  lib/          # Klien Supabase, env config, error handling, helper
  types/        # Tipe TypeScript bersama
supabase/
  migrations/   # SQL migration (profiles, RLS, trigger)
```

## Supabase Auth & Database

Autentikasi sepenuhnya oleh **Supabase Auth** (email + password) — tidak ada password system sendiri. Frontend hanya menyimpan sesi yang diberikan Supabase.

### Menerapkan migrasi

File migration ada di `supabase/migrations/`, dijalankan sekali berurutan:

1. **Supabase Dashboard** → SQL Editor → salin isi file migration → Run, atau
2. **Supabase CLI**: `supabase link --project-ref <ref>` lalu `supabase db push`.

`20260917000000_create_profiles.sql` membuat:

- Tabel `public.profiles`: `id` (FK ke `auth.users`), `nama`, `role`, `created_at`, `updated_at` (otomatis via trigger)
- Trigger pembuatan profil otomatis setiap user baru dibuat — **user pertama = SUPERADMIN**, berikutnya = ADMIN
- **RLS**: baca hanya untuk user terautentikasi; update baris sendiri; update semua baris khusus SUPERADMIN
- Guard: hanya SUPERADMIN yang boleh mengubah `role` via REST API (cegah eskalasi role); akses admin (SQL editor / service_role) tetap lolos

### User pertama & login

1. Isi `.env` (URL + anon key), restart dev server.
2. Terapkan migration di atas.
3. Dashboard Supabase → Authentication → Users → **Add user** (email + password).
4. Trigger otomatis membuat profilnya; user pertama mendapat role SUPERADMIN.
5. Login lewat halaman `/login` aplikasi.

Mengubah role user lain: dari SQL editor (`update public.profiles set role = 'LEGAL' where id = '...'`) atau modul manajemen pengguna yang akan dibuat nanti.

### GIS (PostGIS)

- Migration `20260917000001` mengaktifkan ekstensi `postgis` (schema `extensions`); `20260917000005_gis_geometry.sql` memastikan ulang secara idempotent.
- `locations.geometry` dan `land_parcels.geometry`: `geometry(Polygon, 4326)` — **SRID 4326 (WGS84) konsisten** di semua kolom geometry (standar KML, OpenStreetMap, native Leaflet). SRID ditegakkan oleh tipe kolom; polygon editor menyusul di modul Peta (§17).
- Spatial index **GIST** di kedua tabel; CHECK `st_isvalid` menolak polygon invalid (self-intersecting) di level database.
- Setelah migration dijalankan, jalankan `supabase/verify_gis.sql` di SQL Editor untuk memverifikasi (read-only + uji tulis yang diakhiri ROLLBACK). PostGIS juga bisa diaktifkan manual via Dashboard → Database → Extensions → postgis.

### Editor Batas Lokasi (polygon induk)

Halaman detail lokasi memiliki section peta: mode **view** menampilkan batas induk sebagai outline hijau + seluruh bidang pada lokasi (biru); tombol **Gambar/Edit Batas** membuka editor Leaflet-Geoman dengan draw polygon, edit vertex (tambah/hapus/pindah), geser polygon, snapping (vertex/edge ke batas sendiri & batas lokasi lain, snap distance dapat diatur), Simpan, dan Batal. Validasi self-intersection dijaga bersama oleh Geoman (`allowSelfIntersection: false`), service (`mapService`), dan CHECK `ST_IsValid` di database.

### Polygon Bidang & Validasi Spatial Server-Side

Halaman detail bidang memiliki section peta serupa: view menampilkan batas induk (outline) + semua bidang lokasi dengan bidang aktif di-highlight; editor `PolygonEditor` (generik, dipakai juga lokasi) mendukung draw/vertex/drag/clear + snapping ke **batas induk**, **vertex/edge bidang lain**, dan endpoint.

Penyimpanan polygon bidang **wajib** lewat RPC `save_parcel_geometry(parcel_id, geojson)` (migration `20260917000006_parcel_spatial_validation.sql`) yang memvalidasi secara atomik server-side: `ST_IsValid`/anti self-intersection (GDE01), berada di dalam parent via `ST_CoveredBy` (GDE02; batas induk belum ada → GDE04), dan **tidak overlap** dengan bidang lain (GDE03) — shared boundary diperbolehkan (toleransi luas intersection ≤ 0,01 m²). Gagal validasi → transaksi dibatalkan, tidak tersimpan, dan pesan error berbahasa Indonesia langsung tampil di editor. RPC berjalan sebagai invoker sehingga RLS tetap berlaku. Verifikasi: `supabase/verify_parcel_validation.sql` (7 skenario, diakhiri ROLLBACK).

### Statistik Pemetaan (§17.6)

View `location_area_stats` (migration `20260917000007_location_area_stats.sql`, `security_invoker` + RLS tabel dasar) menghitung per lokasi dengan PostGIS saat dibaca: **luas parent**, **total luas bidang** (netto = `ST_Union`, bruto = Σ per bidang), **sisa luas**, dan **persentase coverage**, plus status `TERPETAK_PENUH` (sisa ≤ 1 m²) / `BELUM_PENUH` / `OVERLAP` (bruto > netto + 0,01 m²) / `GEOMETRY_INVALID`. Panel "Pemetaan Area" di halaman detail lokasi menampilkan semuanya (termasuk peringatan detail saat OVERLAP/GEOMETRY_INVALID). Verifikasi: `supabase/verify_area_stats.sql` (4 skenario, ROLLBACK).

Aturan arsitektur (AGENTS.md §3): `UI → Component/Hook → Service Layer → Supabase → PostgreSQL/Storage`. Query Supabase tidak boleh ditulis langsung di component; business logic tidak boleh bercampur dengan UI.

## Deployment (Netlify)

- Build command `npm run build`, publish directory `dist` (lihat `netlify.toml`).
- SPA routing tetap berjalan setelah refresh (redirect sudah diatur di `netlify.toml`).
- Set environment variable `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` di dashboard Netlify.
- Jangan pernah menyimpan `service_role key`, credentials, atau secrets di frontend atau di Git (`Jangan commit .env` — lihat `.gitignore`).

## Status

Kerangka aplikasi: routing + protected routes, layout (sidebar + header), Supabase Auth (login/logout/session), profiles + RLS, **modul Lokasi**, **modul Bidang Tanah** (`land_parcels`), **modul Pihak** (`parties` + relasi N:N `parcel_parties`), dan **modul Legalitas** (`legalities` per bidang — checklist 14 jenis dokumen standar dengan persentase kelengkapan; migration `20260917000004_create_legalities.sql`; persentase = Ada ÷ (total − Tidak Relevan)). Kolom geometry tersedia di DB; polygon editor menyusul pada modul Peta (AGENTS.md §17). Modul bisnis lain (survey, pembahasan, pembebasan, dst.) belum dibuat.
