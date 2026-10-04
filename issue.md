# Feature Planning: Integrasi Import GIS (KML & SHP) pada Peta Lokasi

## Deskripsi
Menambahkan fungsionalitas Import data spasial (KML dan Shapefile ZIP) ke dalam komponen Peta pada menu Lokasi. Fitur ini harus mematuhi alur kerja (workflow) import GIS yang ditetapkan pada pedoman arsitektur aplikasi (referensi `AGENTS.md` poin 19-27).

## Tujuan Utama
Memungkinkan pengguna untuk mengunggah file GIS, memvalidasi dan memetakan datanya, mempratinjau hasilnya di peta, lalu menyimpannya sebagai salah satu dari:
1. **Parent Area (Batas Induk Lokasi)**
2. **Land Parcel (Bidang Tanah anak dari Lokasi ini)**
3. **Reference Layer (Layer referensi visual)**

---

## High-Level Implementation Instructions (Untuk Programmer / Model)

### 1. Persiapan Dependencies
- Pastikan library pihak ketiga yang aman digunakan untuk parsing GIS klien-sisi. Contoh yang direkomendasikan:
  - `shpjs` (atau variannya) untuk mengekstrak SHP ZIP ke GeoJSON.
  - `@tmcw/togeojson` untuk mengkonversi KML ke GeoJSON.
- Jangan menambahkan dependency pemrosesan server-side berat kecuali disetujui. Lakukan parsing file sejauh mungkin di client-side (browser) lalu kirim `GeoJSON` ke API/Service.

### 2. Pembuatan UI/UX Komponen Import (Wizard / Modal)
Buat komponen wizard dengan langkah-langkah terisolasi sesuai workflow mutlak aplikasi:
- **Step 1: UPLOAD**
  - Buat area *drag-and-drop* yang menerima ekstensi `.kml` dan `.zip` (berisi shp, shx, dbf, prj).
- **Step 2: ANALYZE & CRS DETECTION**
  - Parsing isi file menjadi GeoJSON sementara di memory.
  - Tampilkan informasi ringkas: nama layer, jumlah fitur (*feature count*), tipe geometri, atribut, dan *bounding box*.
  - Deteksi CRS (Sistem Koordinat). Jika format KML, asumsikan WGS84/EPSG:4326. Jika SHP dan tidak terdapat file `.prj`, **wajib** tampilkan opsi agar *user* memilih CRS yang tepat.
- **Step 3: IMPORT TARGET & FIELD MAPPING**
  - Minta *user* memilih target import: `PARENT_AREA` (batas lokasi), `LAND_PARCEL` (bidang tanah), atau `REFERENCE` (hanya referensi peta).
  - Tampilkan tabel pemetaan (*Field Mapping*): **Atribut File Sumber** -> **Atribut GadeSystem** (contoh: *LUAS* -> *luas*, *PEMILIK* -> *nama pihak*). User boleh mengabaikan atribut tertentu.
- **Step 4: PREVIEW**
  - Gambar fitur spasial di atas peta (*Leaflet Map*) sebagai layer transparan.
  - Jalankan cek validitas geometri (overlap, invalid geometry) secara visual (bisa menggunakan *API endpoint* untuk mengecek menggunakan *PostGIS* `ST_IsValid`).
- **Step 5: IMPORT (Execution)**
  - Tampilkan ringkasan hasil sebelum eksekusi akhir: `Imported`, `Skipped` (invalid/duplicate), `Review Required`.
  - Eksekusi penyimpanan (via *Service Layer*) hanya untuk geometri yang lolos validasi.

### 3. Modifikasi Service Layer & Database (Backend)
- Pastikan *Service Layer* (`gisImportService.ts` / `mapService.ts`) memiliki fungsi yang menerima format internal (GeoJSON valid ber-CRS EPSG:4326).
- Jangan menyimpan hasil import mentah-mentah jika targetnya adalah Bidang (`LAND_PARCEL`). Gunakan aturan `spatial validation` PostGIS:
  - Harus *inside parent* (di dalam Batas Lokasi).
  - *No overlap* dengan bidang lain di lokasi yang sama.
  - Cegah *self-intersection*.
- Simpan aktivitas import ini ke dalam `audit_logs`.

### 4. Batasan & Aturan Ketat yang Tidak Boleh Dilanggar
- **Dilarang langsung melakukan `INSERT` ke database setelah upload.** Harus melalui tahap preview dan konfirmasi *user*.
- Semua format wajib di-standarisasi dan dikonversi ke internal **GeoJSON (EPSG:4326)** sebelum diteruskan dari *Service* ke database (PostgreSQL/PostGIS).
- Bisnis logik spasial harus diletakkan di *service layer* dan *database* (RPC Supabase), bukan tersebar di dalam komponen UI (React).

---

## Test Plan / Acceptance Criteria
1. Mengunggah file `.zip` (Shapefile) tanpa file `.prj` akan memunculkan peringatan untuk memilih CRS manual.
2. Mengunggah `.kml` akan otomatis diurai menjadi GeoJSON dan ditampilkan dengan benar pada tahap *Preview*.
3. Sistem mendeteksi fitur yang saling tumpang tindih (*overlap*) jika mencoba menyimpan *Land Parcel*, lalu mencegah atau menandainya.
4. Fitur yang berhasil disimpan akan langsung muncul sebagai *layer* yang bisa diklik / dikelola pada Peta Lokasi.
