// Hasil RPC find_nearest_parcels (migration 20260917000008).
export interface NearestParcel {
  id: string
  kode: string
  nomor_bidang: string | null
  jenis_hak: string | null
  luas: number | null
  lokasi_id: string
  lokasi_kode: string
  lokasi_nama: string
  jarak_m: number
}

// Hasil RPC find_nearest_locations.
export interface NearestLocation {
  id: string
  kode: string
  nama: string
  jarak_m: number
}

// Titik pencarian (lat/lng WGS84) — dari GPS atau klik peta.
export interface GeoPoint {
  lat: number
  lng: number
}
