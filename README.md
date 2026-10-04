# GadeSystem — Garda Depan Pertanahan

Aplikasi web internal Tim Gade untuk mengelola survey lokasi, pembahasan, bidang tanah, pihak/pemilik, legalitas, proses pembebasan, project, arsip, dokumen digital, serah terima, monitoring, laporan, audit, dan peta/GIS pertanahan.

Spesifikasi lengkap: [`AGENTS.md`](AGENTS.md).

## Tech Stack

| Lapisan | Teknologi |
| --- | --- |
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS 4 · React Router 7 |
| Peta | Leaflet + Leaflet-Geoman · proj4 · turf |
| Backend | Supabase (Auth · PostgreSQL + PostGIS · Storage) |
| Deployment | Netlify |

## Prasyarat

- Node.js 20+ (di mesin development ini tersedia portable di `C:\Users\USER\nodejs\...`)
- Akun Supabase (paket gratis memadai)

## Instalasi

```bash
npm install
copy .env.example .env   # lalu isi — lihat bagian Environment
```

## Development

```bash
npm run dev        # buka http://localhost:5173
```

| Script | Fungsi |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Typecheck (`tsc --noEmit`) + production build |
| `npm run typecheck` | Cek TypeScript saja |
| `npm run preview` | Preview hasil build |

## Environment Variables

Semua variabel berawalan `VITE_` **ikut terkirim ke browser** — hanya anon key yang boleh di sini. `service_role key` **dilarang keras** ada di frontend.

Salin `.env.example` → `.env`, isi dari dashboard Supabase (**Project Settings → API Data**):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

> Catatan: isi URL **basis** (tanpa `/rest/v1/`). Tanpa `.env`, aplikasi tetap berjalan dan halaman login menampilkan peringatan.

## Supabase Setup

1. **Buat proyek** di [supabase.com](https://supabase.com), salin URL + anon key ke `.env`.
2. **Jalankan migration** berurutan (Dashboard → SQL Editor, atau `supabase db push`):

   | # | File | Isi |
   | --- | --- | --- |
   | 0 | `20260917000000_create_profiles.sql` | profiles + trigger user pertama=SUPERADMIN + RLS |
   | 1 | `20260917000001_create_locations.sql` | locations + PostGIS + RLS |
   | 2 | `20260917000002_create_land_parcels.sql` | land_parcels (locations 1:N) |
   | 3 | `20260917000003_create_parties.sql` | parties + parcel_parties (N:N) |
   | 4 | `20260917000004_create_legalities.sql` | legalities per bidang |
   | 5 | `20260917000005_gis_geometry.sql` | SRID/GIST/validitas geometry |
   | 6 | `20260917000006_parcel_spatial_validation.sql` | RPC `save_parcel_geometry` |
   | 7 | `20260917000007_location_area_stats.sql` | view statistik pemetaan |
   | 8 | `20260917000008_nearest_search.sql` | RPC pencarian terdekat |
   | 9 | `20260917000009_create_surveys.sql` | surveys (lokasi/bidang) |
   | 10 | `20260917000010_create_acquisitions.sql` | pembebasan + rekap per lokasi |
   | 11 | `20260917000011_create_projects.sql` | projects (kode PRJ-YYYY-NNN) |
   | 12 | `20260917000012_create_archives.sql` | arsip + aturan relasi §12 |
   | 13 | `20260917000013_create_archive_documents.sql` | bucket privat + dokumen digital |
   | 14 | `20260917000014_create_handovers.sql` | serah terima + RPC atomik |
   | 15 | `20260917000015_validate_parcel_geometry.sql` | validasi tanpa insert |
   | 16 | `20260917000016_gis_field_templates.sql` | template field mapping |
   | 17 | `20260917000017_reference_layers.sql` | reference layer (§18) |
   | 18 | `20260917000018_dashboard_stats.sql` | RPC statistik dashboard |
   | 19 | `20260917000019_create_audit_logs.sql` | audit log append-only |
   | 20 | `20260917000020_geometry_access_hardening.sql` | geometry hanya via RPC |
   | 21 | `20260917000021_create_discussions.sql` | pembahasan lokasi & bidang + RPC keputusan |
   | 22 | `20260917000022_role_permissions.sql` | matriks izin role × menu (menu Pengaturan) |

3. **Verifikasi** (opsional, read-only + ROLLBACK): `verify_gis.sql`, `verify_parcel_validation.sql`, `verify_area_stats.sql`, `verify_nearest.sql` di `supabase/`.
   Untuk kemudahan, seluruh 23 migrasi terangkum dalam `supabase/apply_all.sql`.
4. **Buat user pertama** — Authentication → Users → Add user. Trigger membuat profilnya otomatis; **user pertama = SUPERADMIN**, berikutnya ADMIN.
5. **Keamanan**: matikan **public signup** (Authentication → Providers → Email → Disable sign up) karena aplikasi internal; ubah role user hanya via SQL editor/SUPERADMIN.

## GIS Setup

- **Peta**: basemap OpenStreetMap; editor polygon induk lokasi & bidang (draw, edit vertex, drag, snapping, save/cancel) di halaman detail masing-masing.
- **Impor** (`/peta/impor`): GeoJSON · KML · Shapefile ZIP · DXF → pipeline UPLOAD → ANALYZE → SELECT LAYER → DETECT/CONFIRM CRS → FIELD MAPPING (dengan template tersimpan) → PREVIEW → VALIDATE → IMPORT. Target: Parent Area / Land Parcel / Reference Layer. **Tidak ada insert sebelum validasi** — spatial validation PostGIS (`ST_IsValid`, inside parent, tanpa overlap) dijalankan server-side per fitur.
- **Ekspor** (`/peta/ekspor`): GeoJSON · KML · SHP ZIP (.shp/.shx/.dbf/.prj) · DXF (layer GADE_PARENT/GADE_PARCEL/GADE_BOUNDARY/GADE_POINT/GADE_LABEL). Cakupan: semua / lokasi / bidang / terpilih / filter.
- **SRID konsisten 4326 (WGS84)**; semua kolom `geometry(Polygon, 4326)` + index GIST.

## Build & Deployment (Netlify)

```bash
npm run build      # output: dist/
npm run preview    # uji hasil build lokal
```

- `netlify.toml` sudah mengatur build command, publish dir `dist`, dan SPA redirect.
- Set environment variable `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY` di Netlify (Site settings → Environment variables).
- Import/ekspor GIS dan dokumen digital dimuat lazy (code-split otomatis).

## Keamanan

- Password sepenuhnya **Supabase Auth** — tidak ada password system sendiri.
- `service_role key` tidak pernah ada di frontend; anon key diproteksi RLS di database.
- RLS aktif di semua tabel; delete data master hanya ADMIN/SUPERADMIN; audit log hanya SUPERADMIN.
- Validasi berlapis: form/service → CHECK database → storage policy → spatial validation PostGIS.
- Audit log append-only (12 jenis aksi §16) — tidak dapat diubah/dihapus via API.
- Gunakan `.env.example` hanya sebagai template — **jangan pernah mengisi nilai asli ke dalamnya**.

## Struktur Proyek

```
src/
  components/   # UI reusable (MapView, PolygonEditor, section per modul, badge)
  pages/        # Halaman per route (list/detail/form tiap modul)
  services/     # Service layer — satu-satunya jalur ke Supabase
  hooks/        # Custom hooks (auth, data per modul, geolocation)
  lib/          # Supabase client, env, errors, CSV, GIS engine
  types/        # Tipe TypeScript bersama
supabase/
  migrations/   # 23 migration SQL berurutan (000000 - 000022)
  apply_all.sql # Bundle seluruh migrasi siap dieksekusi di SQL Editor
  verify_*.sql  # Skrip verifikasi pasca-migration
```

Aturan arsitektur (AGENTS.md §3): `UI → Component/Hook → Service Layer → Supabase → PostgreSQL/Storage` — query Supabase tidak boleh ditulis langsung di component.

## Status Modul

**Selesai**:
- Auth + profiles (role-based: SUPERADMIN, ADMIN, SURVEYOR, LEGAL)
- Lokasi (analisis & batas polygon induk)
- Bidang Tanah (polygon anak + relasi 1:N lokasi)
- Pihak / Pemilik (relasi N:N via parcel_parties)
- Legalitas (checklist, jenis dokumen, persentase kelengkapan)
- Survey (lokasi & bidang + GPS browser Geolocation)
- Pembahasan (keputusan LAYAK/PERLU_KAJIAN/TIDAK_LAYAK + trigger efek status otomatis)
- Pembebasan (transaksi, uang muka, pelunasan, rekap per lokasi)
- Project (kode PRJ-YYYY-NNN)
- Arsip (fisik: gudang, rak, box, folder + 4 relasi: LOCATION, PARCEL, PROJECT, GENERAL)
- Dokumen Digital (Supabase Storage private bucket)
- Serah Terima (berkas masuk/keluar/kembali + cetak PDF tanda terima)
- Peta GIS (Leaflet + Geoman, vertex editing, snapping, spatial validation, pencarian, nearby)
- Impor GIS (GeoJSON, KML, SHP ZIP, DXF + CRS detection + field mapping + preview + validation)
- Ekspor GIS (GeoJSON, KML, SHP ZIP, DXF)
- Dashboard (ringkasan status master, luas, GIS, arsip)
- Laporan (monitoring progres pembebasan, export CSV)
- Audit Log (append-only 12 jenis aksi, filter entitas & aksi)
- Pengaturan (profil pengguna, manajemen role SUPERADMIN, health check koneksi Supabase, matriks role permissions)
