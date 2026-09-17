GADE — GARDA DEPAN PERTANAHAN

1. IDENTITAS PROJECT

Nama:
GadeSystem — Garda Depan Pertanahan

Jenis:
Internal web application

Tujuan:
Membantu Tim Gade mengelola:

* survey lokasi
* pembahasan lokasi
* bidang tanah
* pihak/pemilik
* legalitas tanah
* proses pembebasan
* project
* arsip dokumen
* dokumen digital
* serah terima dokumen
* monitoring
* laporan
* audit
* peta/GIS pertanahan

PROJECT BARU.
Tidak ada data lama yang perlu dimigrasikan.

---

2. STACK

Frontend:

* React
* TypeScript
* Vite
* Tailwind CSS

Backend/Data:

* Supabase
* PostgreSQL
* Supabase Auth
* Supabase Storage
* Row Level Security
* PostGIS

GIS Frontend:

* Leaflet
* Leaflet-Geoman atau library editing GIS setara
* GeoJSON

Version Control:

* Git
* GitHub

Deployment:

* Netlify

Jika membutuhkan pemrosesan GIS server-side yang lebih kompleks, arsitektur harus dapat menggunakan GDAL/ogr2ogr tanpa mengubah model data utama.

Jangan menambah dependency tanpa alasan.

---

3. ARSITEKTUR

Gunakan pola:

UI
↓
Component / Hook
↓
Service Layer
↓
Supabase
↓
PostgreSQL / Storage

Jangan menyebarkan query Supabase langsung ke seluruh component.

Gunakan service layer:

* locationService
* parcelService
* partyService
* legalityService
* surveyService
* discussionService
* acquisitionService
* projectService
* archiveService
* documentService
* handoverService
* mapService
* gisImportService
* gisExportService
* dashboardService
* auditService

Business logic tidak boleh bercampur dengan UI.

---

4. PRINSIP DATA UTAMA

 4.1 LOKASI / AREAL

Lokasi adalah area besar yang sedang dianalisis atau dibebaskan.

Contoh:
GDE-LOC-2026-001

Satu lokasi dapat memiliki banyak bidang.

Data minimal:

* id
* kode
* nama
* alamat
* desa
* kecamatan
* kabupaten
* luas_target
* luas_teridentifikasi
* luas_deal
* peruntukan
* kondisi_lahan
* kondisi_pasar
* catatan
* status
* geometry
* created_at
* updated_at

Status:

* SURVEY
* PEMBAHASAN
* PROSES_PEMBEBASAN
* SELESAI
* DITOLAK
* DITUNDA

Geometry:

* Polygon PostGIS
* menjadi batas induk/areal
* pada UI dapat ditampilkan sebagai boundary/outline

Jangan menyimpan batas induk hanya sebagai LineString jika polygon dapat digunakan sebagai source of truth.

---

5. BIDANG TANAH

Bidang adalah bagian individual dari suatu lokasi.

Contoh:
GDE-BDG-2026-001

Relasi:
LOKASI 1:N BIDANG

Data minimal:

* id
* lokasi_id
* kode
* nomor_bidang
* luas
* jenis_hak
* nomor_hak
* status_pembebasan
* harga_penawaran
* harga_kesepakatan
* tanggal_kesepakatan
* catatan
* geometry
* created_at
* updated_at

Geometry:

* Polygon PostGIS
* nullable sampai bidang dipetakan

Status:

* TERIDENTIFIKASI
* SURVEY
* LEGAL_CHECK
* NEGOSIASI
* SIAP_TRANSAKSI
* TRANSAKSI
* SELESAI
* DITOLAK
* DITUNDA

---

6. PIHAK / PEMILIK

Jangan menyimpan pemilik sebagai satu string pada bidang.

Satu bidang dapat memiliki banyak pihak.

Satu pihak dapat memiliki banyak bidang.

Gunakan:
BIDANG N:N PIHAK

melalui tabel penghubung.

Data pihak:

* id
* nama
* nik
* alamat
* nomor_telepon
* tipe_pihak
* catatan

Tipe pihak:

* PEMEGANG_HAK
* AHLI_WARIS
* KUASA
* PENGUASA
* PIHAK_LAIN

Relasi bidang-pihak:

* parcel_id
* party_id
* peran
* keterangan

---

7. LEGALITAS

Legalitas terutama berada pada level BIDANG.

Satu bidang dapat mempunyai banyak legalitas.

Legalitas dapat memiliki pihak terkait.

Contoh:

* Sertifikat
* SHM
* SHGB
* AJB
* KTP
* KK
* PBB
* SPPT
* Girik
* Letter C
* Surat Waris
* Akta Waris
* Surat Kuasa
* Dokumen Lainnya

Data:

* id
* bidang_id
* pihak_id nullable
* jenis_dokumen
* nomor_dokumen
* tanggal_dokumen
* penerbit
* status
* catatan
* created_at
* updated_at

Status:

* ADA
* BELUM_ADA
* PROSES
* TIDAK_RELEVAN
* PERLU_VERIFIKASI

---

8. SURVEY

Survey dapat dilakukan pada:

* LOKASI
* BIDANG

Minimal salah satu harus terisi.

Survey lokasi digunakan untuk:

* informasi lokasi
* peruntukan
* kondisi lahan
* kondisi pasar
* akses
* lingkungan

Data:

* id
* lokasi_id nullable
* bidang_id nullable
* tanggal_survey
* surveyor
* hasil_survey
* catatan
* latitude
* longitude
* created_at

---

9. PEMBAHASAN

Pembahasan dapat terkait:

* lokasi
* bidang

Data:

* id
* lokasi_id nullable
* bidang_id nullable
* tanggal
* peserta
* hasil
* catatan
* keputusan
* created_at

Keputusan:

* LAYAK
* PERLU_KAJIAN
* TIDAK_LAYAK

Simpan histori.

---

10. PEMBEBASAN

Pembebasan terutama dilakukan pada BIDANG.

Data:

* id
* bidang_id
* tanggal_mulai
* harga_penawaran
* harga_kesepakatan
* luas_dibebaskan
* uang_muka
* pelunasan
* tanggal_pelunasan
* pihak_terlibat
* catatan
* status_transaksi
* created_at
* updated_at

Status:

* NEGOSIASI
* SIAP_TRANSAKSI
* TRANSAKSI
* SELESAI
* BATAL

---

11. PROJECT

Project adalah entitas mandiri.

Contoh:
PRJ-2026-001

Digunakan untuk:

* legal project
* izin
* dokumen project
* arsip project

Project tidak wajib memiliki hubungan dengan bidang.

---

12. ARSIP

Arsip adalah entitas mandiri.

Arsip dapat berkaitan dengan:

* LOKASI
* BIDANG
* PROJECT
* UMUM

Tipe relasi:

* LOCATION
* PARCEL
* PROJECT
* GENERAL

Aturan:
LOCATION:
location_id wajib

PARCEL:
parcel_id wajib

PROJECT:
project_id wajib

GENERAL:
location_id, parcel_id, project_id harus null

Data minimal:

* id
* kode
* nama_dokumen
* kategori
* jenis_dokumen
* nomor_dokumen
* tanggal_dokumen
* tipe_relasi
* location_id nullable
* parcel_id nullable
* project_id nullable
* gudang
* rak
* box
* folder
* status
* catatan
* created_at
* updated_at

Kode:
ARS-YYYY-NNN

Status:

* TERSEDIA
* DIPINJAM
* HILANG
* RUSAK
* DIARSIPKAN

---

13. DOKUMEN DIGITAL

Gunakan Supabase Storage private bucket.

Metadata file disimpan di PostgreSQL.

Data:

* id
* archive_id
* file_name
* storage_path
* mime_type
* file_size
* uploaded_by
* uploaded_at

File tidak boleh disimpan sebagai base64 dalam database.

---

14. SERAH TERIMA

Jenis:

* BERKAS_MASUK
* BERKAS_KELUAR
* BERKAS_KEMBALI

Data:

* id
* nomor
* archive_id
* tanggal
* dari
* kepada
* keperluan
* catatan
* created_by
* created_at

Aturan:
BERKAS_KELUAR → arsip DIPINJAM
BERKAS_KEMBALI → arsip TERSEDIA

Simpan histori permanen.

---

15. AUTHENTICATION

Gunakan Supabase Auth.

Role:

* SUPERADMIN
* ADMIN
* SURVEYOR
* LEGAL

Buat profiles table:

* id
* nama
* role
* created_at
* updated_at

Jangan menyimpan password sendiri.

Authorization wajib ditegakkan melalui RLS/database.

Frontend bukan satu-satunya pengaman.

---

16. AUDIT LOG

Catat:

* login
* logout
* create
* update
* delete
* upload
* download
* perubahan status
* serah terima
* import GIS
* export GIS
* perubahan geometry

Data:

* user_id
* action
* entity
* entity_id
* description
* created_at

---

17. GIS / MAP

Gunakan:

* Leaflet
* Leaflet-Geoman atau library editing yang setara
* OpenStreetMap sebagai basemap bila sesuai
* GeoJSON
* PostGIS

 17.1 Parent Area

LOCATION memiliki:
geometry = Polygon

Polygon induk:

* dapat dibuat
* diedit
* disimpan
* dibatalkan
* dapat dibuka kembali untuk diedit

Pada tampilan biasa:
polygon induk ditampilkan sebagai boundary/outline.

 17.2 Child Parcel

BIDANG memiliki:
geometry = Polygon nullable

Polygon bidang:

* dapat dibuat
* diedit
* disimpan
* dibatalkan
* dibuka kembali
* dapat dipindahkan
* dapat diubah vertex-nya

 17.3 Vertex Editing

User harus dapat:

* menambah vertex
* menghapus vertex
* memindahkan vertex
* memindahkan polygon

 17.4 Snapping

Dukung:

* nearest vertex
* endpoint snapping
* edge/segment snapping
* snapping ke parent boundary
* snapping ke bidang lain

Snap distance harus dapat dikonfigurasi.

 17.5 Spatial Validation

Saat menyimpan geometry:

* geometry harus valid
* parent polygon harus valid
* child harus berada di dalam parent
* child tidak boleh overlap dengan child lain
* shared boundary diperbolehkan
* cegah self-intersection

Gunakan PostGIS server-side.

Gunakan:

* ST_IsValid
* ST_Within / ST_CoveredBy
* ST_Intersects
* ST_Area
* spatial indexes

 17.6 Area Calculation

Hitung:

* luas parent
* total luas child
* sisa luas
* persentase coverage

Tampilkan:

TERPETAK_PENUH
BELUM_PENUH
OVERLAP
GEOMETRY_INVALID

 17.7 Nearest

Dukung:

* bidang terdekat dari posisi user
* lokasi terdekat
* bidang terdekat dari titik peta
* jarak dalam meter

Gunakan PostGIS spatial query dan spatial index.

 17.8 GPS

Survey dapat menggunakan browser Geolocation API.

Tombol:
"Gunakan Lokasi Saya"

Simpan:
latitude
longitude

Jangan membaca lokasi tanpa izin user.

---

18. GIS LAYER

Peta dapat memiliki layer:

* PARENT_AREA
* LAND_PARCEL
* REFERENCE
* DRAWING

Reference layer dapat berisi:

* jalan
* sungai
* batas desa
* masterplan
* kontur
* data survey

Reference layer tidak otomatis menjadi bidang.

---

19. GIS IMPORT

Dukung:

* GeoJSON
* KML
* SHP ZIP
* DXF

Semua format diubah menjadi internal GeoJSON sebelum masuk PostGIS.

Workflow:

UPLOAD
→ ANALYZE
→ SELECT LAYER
→ DETECT CRS
→ CONFIRM CRS
→ FIELD MAPPING
→ PREVIEW
→ VALIDATE
→ IMPORT

Jangan langsung menyimpan hasil import.

---

20. SHAPEFILE

User upload ZIP yang dapat berisi:

* .shp
* .shx
* .dbf
* .prj

Jika .prj tidak ada:
minta user memilih CRS.

Tampilkan:

* layer
* feature count
* geometry type
* CRS
* attributes
* bounding box

---

21. KML

Konversi:
KML
→ GeoJSON

KML menggunakan WGS84/EPSG:4326.

Pertahankan bila tersedia:

* nama
* description
* folder
* geometry

---

22. DXF

DXF adalah format CAD.

Tahap awal dukung:

* POINT
* LINE
* LWPOLYLINE
* POLYLINE
* closed polyline menjadi polygon jika aman
* layer CAD
* ARC/CIRCLE bila dapat dikonversi secara aman

Jika CRS tidak diketahui:
minta user memilih CRS.

Jika geometry tidak dapat dikonversi dengan aman:
jangan mengarang geometry.

Untuk proses kompleks, siapkan arsitektur yang dapat menggunakan GDAL/ogr2ogr server-side.

---

23. IMPORT PREVIEW

Sebelum import tampilkan:

* total feature
* geometry type
* CRS
* invalid geometry
* duplicate candidate
* bounding box
* luas total

Tampilkan preview di peta.

---

24. FIELD MAPPING

Import harus menyediakan:

SOURCE FIELD
→ GADE FIELD

Contoh:

NO_BIDANG
→ nomor_bidang

LUAS
→ luas

NAMA_PEMILIK
→ nama pihak

STATUS
→ status bidang

User dapat mengabaikan field tertentu.

Mapping template dapat disimpan.

---

25. IMPORT TARGET

User memilih:

* PARENT AREA
* LAND PARCEL
* REFERENCE LAYER

Jika LAND PARCEL:
setiap feature menjadi candidate parcel.

Sebelum insert:

* valid geometry
* inside parent
* no overlap
* duplicate detection

Tampilkan:

Imported
Skipped
Invalid
Duplicate
Review Required

---

26. GIS EXPORT

Dukung:

* GeoJSON
* KML
* SHP ZIP
* DXF

Export berdasarkan:

* semua
* lokasi
* bidang
* bidang terpilih
* hasil filter

## SHP

Output ZIP:

* .shp
* .shx
* .dbf
* .prj

## KML

Gunakan EPSG:4326.

## DXF

Gunakan layer:

* GADE_PARENT
* GADE_PARCEL
* GADE_BOUNDARY
* GADE_POINT
* GADE_LABEL

Boleh memasukkan label:

* kode bidang
* nomor bidang
* luas

GIS export tidak mengubah database.

---

27. CRS

Setiap import harus memiliki CRS.

Prioritas:

1. metadata/prj
2. metadata format
3. user selection

Jika CRS tidak diketahui:
jangan import sebagai geometry terverifikasi.

Gunakan reprojection sebelum penyimpanan jika diperlukan.

Sistem harus menyimpan CRS dengan jelas.

---

28. MAP SEARCH

Peta harus mendukung pencarian:

* kode lokasi
* kode bidang
* nama pemilik
* desa
* kecamatan
* status
* nomor hak

Saat hasil ditemukan:

* zoom geometry
* highlight geometry
* tampilkan detail

---

29. UI/UX

Sederhana.
Bersih.
Responsif.
Mudah dipahami pengguna non-teknis.

Menu:

Dashboard
Lokasi
Bidang Tanah
Pihak/Pemilik
Survey
Pembahasan
Legalitas
Pembebasan
Project
Arsip
Peta
Serah Terima
Laporan
Audit Log
Pengaturan

---

30. DASHBOARD

Tampilkan:

LOKASI:

* total
* survey
* pembahasan
* proses pembebasan
* selesai
* ditolak
* ditunda

BIDANG:

* total
* legal check
* negosiasi
* siap transaksi
* transaksi
* selesai

LUAS:

* target
* teridentifikasi
* deal
* belum deal

PIHAK:

* total

ARSIP:

* total
* lokasi
* bidang
* project
* umum
* tersedia
* dipinjam

GIS:

* total lokasi dengan geometry
* total bidang dengan geometry
* total coverage
* geometry invalid
* overlap
* area belum terpetakan

---

31. DATABASE

Gunakan:

* foreign key
* unique constraint
* indexes
* check constraints
* timestamps

Gunakan migration SQL.

Untuk PostGIS:

* geometry columns
* spatial indexes
* valid SRID

Jangan membuat satu tabel raksasa untuk semua data.

---

32. SECURITY

Wajib:

* Supabase Auth
* RLS
* Storage policies
* role authorization
* input validation
* file validation
* GIS import validation

Jangan expose:
service_role key

ke frontend.

Gunakan environment variables.

---

33. SERVICE LAYER

UI tidak boleh berisi query database kompleks.

Gunakan service:

* locationService
* parcelService
* partyService
* legalityService
* surveyService
* discussionService
* acquisitionService
* projectService
* archiveService
* documentService
* handoverService
* mapService
* gisImportService
* gisExportService
* dashboardService
* auditService

---

34. GITHUB

Jangan commit:

* .env
* credentials
* secrets
* service_role key

Buat:
.env.example
README.md

---

35. NETLIFY

Frontend harus siap untuk Netlify.

Jangan hardcode:

* Supabase URL
* configuration
* secret

Gunakan environment variable.

SPA routing harus tetap berjalan setelah refresh.

---

36. DEVELOPMENT RULES

Sebelum coding:

1. baca AGENTS.md
2. baca struktur project
3. periksa existing component/service
4. pahami task

Saat coding:

1. kerjakan hanya task saat ini
2. jangan mengerjakan task berikutnya
3. jangan membuat fitur yang belum diminta
4. jangan melakukan refactor besar tanpa alasan
5. reuse code

Setelah coding:

1. typecheck
2. lint jika tersedia
3. test jika tersedia
4. build
5. cek console
6. cek Supabase query
7. cek RLS jika terkait database
8. cek geometry jika terkait GIS

---

37. COMMUNICATION

Jawaban singkat.

Gunakan format:

Changed:

* ...

Test:

* ...

Issue:

* ...

Risk:

* ...

Jika task jelas, langsung kerjakan.

---

38. ATURAN BISNIS MUTLAK

Jangan pernah menganggap:

1 lokasi = 1 bidang

Jangan pernah menganggap:

1 bidang = 1 pemilik

Jangan pernah menganggap:

1 pemilik = 1 bidang

Jangan pernah menganggap:

1 arsip = 1 bidang

Model wajib mendukung:

1 lokasi → banyak bidang
1 bidang → banyak pihak
1 pihak → banyak bidang
1 bidang → banyak legalitas
1 lokasi → banyak survey
1 bidang → banyak survey
1 lokasi → banyak pembahasan
1 bidang → banyak pembahasan
1 bidang → pembebasan
1 lokasi → banyak arsip
1 bidang → banyak arsip
1 project → banyak arsip
arsip umum → tanpa relasi

---

39. PRIORITAS

1. Integritas data
2. Keamanan
3. Kebenaran geometri
4. Kesederhanaan
5. Kemudahan penggunaan
6. Maintainability
7. Performa
8. Kemudahan deployment
