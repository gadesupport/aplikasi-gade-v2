import { ServiceError, toServiceError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { requireSupabase, unwrapQuery } from './query'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { LocationAreaStats } from '../types/areaStats'

// Batas lokasi lain yang dimuat sebagai snapping guide saat editing.
const GUIDE_LIMIT = 200

export interface LocationGuide {
  id: string
  kode: string
  nama: string
  geometry: Polygon
}

export interface ParcelGuide {
  id: string
  kode: string
  nomor_bidang: string | null
  geometry: Polygon
}

// Validasi ring polygon sebelum kirim: minimal 4 titik dan ring tertutup.
function validatePolygon(polygon: Polygon): void {
  const ring = polygon.coordinates?.[0]
  if (!ring || ring.length < 4) {
    throw new ServiceError('Polygon tidak valid: minimal 3 titik.')
  }
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    throw new ServiceError('Polygon tidak valid: ring belum tertutup.')
  }
}

// Akses geometry (PostGIS Polygon 4326) — PostgREST otomatis mengonversi
// kolom geometry ke/dari GeoJSON. Validasi ST_IsValid ditegakkan database
// (CHECK constraint, migration 000005); di sini divalidasi ring saja.
export const mapService = {
  async getLocationGeometry(locationId: string): Promise<Polygon | null> {
    requireSupabase()
    const row = await unwrapQuery<{ geometry: Polygon | null } | null>(
      supabase.from('locations').select('geometry').eq('id', locationId).maybeSingle(),
    )
    return row?.geometry ?? null
  },

  // Simpan batas lokasi. Polygon null berarti hapus batas.
  async saveLocationGeometry(locationId: string, polygon: Polygon | null): Promise<void> {
    requireSupabase()
    if (polygon) validatePolygon(polygon)
    const { data, error } = await supabase
      .from('locations')
      .update({ geometry: polygon })
      .eq('id', locationId)
      .select('id')
    if (error) throw toServiceError(error)
    if (!data || data.length === 0) {
      throw new ServiceError('Lokasi tidak ditemukan.', { code: 'LOCATION_NOT_FOUND' })
    }
  },

  // Batas lokasi lain (exclude lokasi aktif) sebagai FeatureCollection
  // untuk layer panduan snapping saat editing.
  async getOtherLocationGeometries(excludeLocationId: string): Promise<FeatureCollection> {
    requireSupabase()
    const rows =
      (await unwrapQuery<LocationGuide[]>(
        supabase
          .from('locations')
          .select('id, kode, nama, geometry')
          .not('geometry', 'is', null)
          .neq('id', excludeLocationId)
          .limit(GUIDE_LIMIT),
      )) ?? []
    const features: Feature[] = rows.map((row) => ({
      type: 'Feature',
      properties: { id: row.id, kode: row.kode, nama: row.nama },
      geometry: row.geometry,
    }))
    return { type: 'FeatureCollection', features }
  },

  // ===== Geometry bidang (child parcel) =====

  async getParcelGeometry(parcelId: string): Promise<Polygon | null> {
    requireSupabase()
    const row = await unwrapQuery<{ geometry: Polygon | null } | null>(
      supabase.from('land_parcels').select('geometry').eq('id', parcelId).maybeSingle(),
    )
    return row?.geometry ?? null
  },

  // Simpan polygon bidang (nullable — null berarti hapus pemetaan bidang).
  // Melewati RPC save_parcel_geometry: validasi spatial server-side
  // (ST_IsValid, dalam parent, tanpa overlap) — gagal validasi berarti
  // TIDAK tersimpan dan pesan errornya siap tampil ke user.
  async saveParcelGeometry(parcelId: string, polygon: Polygon | null): Promise<void> {
    requireSupabase()
    if (polygon) validatePolygon(polygon)
    const { error } = await supabase.rpc('save_parcel_geometry', {
      p_parcel_id: parcelId,
      p_geojson: polygon,
    })
    if (error) throw toServiceError(error)
  },

  // Statistik pemetaan satu lokasi (luas parent/bidang, sisa, coverage,
  // status) — dihitung PostGIS oleh view location_area_stats (§17.6).
  async getLocationAreaStats(locationId: string): Promise<LocationAreaStats | null> {
    requireSupabase()
    return unwrapQuery<LocationAreaStats | null>(
      supabase.from('location_area_stats').select('*').eq('location_id', locationId).maybeSingle(),
    )
  },

  // Semua bidang bergeometry pada satu lokasi (exclude bidang tertentu bila
  // perlu) — untuk tampilan peta lokasi dan panduan snapping editor bidang.
  async getLocationParcelsGeometries(
    locationId: string,
    excludeParcelId?: string,
  ): Promise<FeatureCollection> {
    requireSupabase()
    let query = supabase
      .from('land_parcels')
      .select('id, kode, nomor_bidang, geometry')
      .eq('lokasi_id', locationId)
      .not('geometry', 'is', null)
    if (excludeParcelId) query = query.neq('id', excludeParcelId)
    const rows = (await unwrapQuery<ParcelGuide[]>(query.limit(GUIDE_LIMIT))) ?? []
    const features: Feature[] = rows.map((row) => ({
      type: 'Feature',
      properties: { id: row.id, kode: row.kode, nomor_bidang: row.nomor_bidang },
      geometry: row.geometry,
    }))
    return { type: 'FeatureCollection', features }
  },
}
