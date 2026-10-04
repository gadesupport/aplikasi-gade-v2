import { ServiceError, toServiceError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { requireSupabase, unwrapQuery } from './query'
import { auditService } from './auditService'
import { isFeatureValid } from '../lib/gis/analyze'
import area from '@turf/area'
import type { Feature, GeoJsonProperties, Geometry, Polygon } from 'geojson'
import type { ParcelStatus } from '../types/parcel'
import { GADE_FIELDS } from '../types/gisImport'
import type { GadeField } from '../types/gisImport'

// Re-export agar pemanggil lama tetap bekerja.
export { GADE_FIELDS }
export type { GadeField }

// GIS import ke database (§25) — TIDAK ADA insert sebelum validasi:
//  1. Validasi client: polygon valid (isFeatureValid) — fitur invalid di-skip.
//  2. Validasi server: RPC validate_parcel_geometry (ST_IsValid, dalam
//     parent, tanpa overlap) SEBELUM insert.
//  3. Insert: parcel dibuat tanpa geometry, lalu geometry disimpan via
//     save_parcel_geometry (validasi ulang server-side).
//  4. Duplicate: kode yang sudah ada di lokasi target → skip (bukan error).

// Field target kini didefinisikan di types/gisImport.ts (re-export di atas).

export interface MappedParcel {
  index: number
  kode: string
  nomor_bidang: string | null
  luas: number | null
  jenis_hak: string | null
  nomor_hak: string | null
  status: ParcelStatus
  namaPihak: string | null
  geometry: Polygon
  valid: boolean
  invalidReason: string | null
}

// Normalisasi geometry: jika Polygon atau MultiPolygon, pastikan ring tertutup
// dan konversikan ke Polygon tunggal yang valid.
export function normalizeToPolygon(geometry: Geometry | null | undefined): Polygon | null {
  if (!geometry) return null
  if (geometry.type === 'Polygon') {
    const closed = geometry.coordinates.map((ring) => {
      if (ring.length < 3) return ring
      const first = ring[0]
      const last = ring[ring.length - 1]
      if (first[0] !== last[0] || first[1] !== last[1]) {
        return [...ring, [first[0], first[1], ...(first.slice(2) || [])]]
      }
      return ring
    })
    return { type: 'Polygon', coordinates: closed }
  }
  if (geometry.type === 'MultiPolygon') {
    if (!geometry.coordinates || geometry.coordinates.length === 0) return null
    let maxArea = -1
    let bestCoords: import('geojson').Position[][] | null = null
    for (const part of geometry.coordinates) {
      const closedPart = part.map((ring) => {
        if (ring.length < 3) return ring
        const first = ring[0]
        const last = ring[ring.length - 1]
        if (first[0] !== last[0] || first[1] !== last[1]) {
          return [...ring, [first[0], first[1], ...(first.slice(2) || [])]]
        }
        return ring
      })
      const testFeature: Feature<Polygon> = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: closedPart },
      }
      const a = area(testFeature)
      if (a > maxArea || bestCoords === null) {
        maxArea = a
        bestCoords = closedPart
      }
    }
    return bestCoords ? { type: 'Polygon', coordinates: bestCoords } : null
  }
  return null
}

// Terapkan field mapping (source field → GADE field, §24) pada feature.
// Feature dinormalisasi menjadi Polygon tertutup; jika tidak valid → invalid.
export function applyFieldMapping(
  features: Feature<Geometry, GeoJsonProperties>[],
  mapping: Record<string, GadeField>,
  fillLuasFromGeometry: boolean,
): MappedParcel[] {
  return features.map((feature, index) => {
    const properties = (feature.properties ?? {}) as Record<string, unknown>
    const mapped: Record<GadeField, string | null> = {
      kode: null,
      nomor_bidang: null,
      luas: null,
      jenis_hak: null,
      nomor_hak: null,
      status: null,
      nama_pihak: null,
    }
    for (const [sourceKey, field] of Object.entries(mapping) as [string, GadeField][]) {
      const value = properties[sourceKey]
      if (field && value !== undefined && value !== null && String(value).trim() !== '') {
        mapped[field] = String(value).trim()
      }
    }

    const normalizedPolygon = normalizeToPolygon(feature.geometry)
    const normalizedFeature: Feature<Geometry, GeoJsonProperties> = normalizedPolygon
      ? { ...feature, geometry: normalizedPolygon }
      : feature
    const isPolygon = Boolean(normalizedPolygon)
    const valid = isPolygon && isFeatureValid(normalizedFeature)
    let invalidReason: string | null = null
    if (!isPolygon) invalidReason = 'Geometry bukan Polygon atau MultiPolygon.'
    else if (!valid) invalidReason = 'Geometry tidak valid (ring/self-intersection/koordinat).'

    let luas: number | null = null
    if (mapped.luas !== null) {
      const parsed = Number(mapped.luas.replace(',', '.'))
      luas = Number.isFinite(parsed) && parsed >= 0 ? parsed : null
    }
    if (luas === null && fillLuasFromGeometry && valid && normalizedPolygon) {
      luas = Math.round(areaM2(normalizedFeature) * 100) / 100
    }

    const status = toStatus(mapped.status)

    return {
      index,
      kode:
        mapped.kode ||
        `IMP-${Date.now().toString().slice(-6)}-${String(index + 1).padStart(3, '0')}`,
      nomor_bidang: mapped.nomor_bidang,
      luas,
      jenis_hak: mapped.jenis_hak,
      nomor_hak: mapped.nomor_hak,
      status,
      namaPihak: mapped.nama_pihak,
      geometry: (normalizedPolygon ?? null) as unknown as Polygon,
      valid,
      invalidReason,
    }
  })
}

function toStatus(raw: string | null): ParcelStatus {
  if (!raw) return 'TERIDENTIFIKASI'
  const normalized = raw.toUpperCase().replace(/[\s-]+/g, '_')
  const statuses: ParcelStatus[] = [
    'TERIDENTIFIKASI',
    'SURVEY',
    'LEGAL_CHECK',
    'NEGOSIASI',
    'SIAP_TRANSAKSI',
    'TRANSAKSI',
    'SELESAI',
    'DITOLAK',
    'DITUNDA',
  ]
  return statuses.includes(normalized as ParcelStatus) ? (normalized as ParcelStatus) : 'TERIDENTIFIKASI'
}

function areaM2(feature: Feature<Geometry, GeoJsonProperties>): number {
  return area(feature)
}

// Validasi import (§23/§25): hitung duplikat kode (dalam file + terhadap
// lokasi target via database) tanpa menulis apa pun.
export const gisImportService = {
  async getExistingParcelCodes(locationId: string): Promise<string[]> {
    requireSupabase()
    const rows =
      (await unwrapQuery<{ kode: string }[]>(
        supabase.from('land_parcels').select('kode').eq('lokasi_id', locationId).limit(5000),
      )) ?? []
    return rows.map((row) => row.kode)
  },

  // Validasi server TANPA insert — RPC validate_parcel_geometry (§25).
  async validateGeometry(locationId: string, geometry: Polygon): Promise<void> {
    requireSupabase()
    const { error } = await supabase.rpc('validate_parcel_geometry', {
      p_lokasi_id: locationId,
      p_geojson: geometry,
    })
    if (error) {
      const message =
        error.message ||
        'Polygon ditolak validasi spatial server-side (invalid/di luar parent/overlap).'
      throw new ServiceError(message, { code: error.code })
    }
  },

  // Import PARENT AREA (§25): simpan polygon batas lokasi.
  async importParentArea(locationId: string, geometry: Polygon): Promise<void> {
    const { mapService } = await import('./mapService')
    await mapService.saveLocationGeometry(locationId, geometry)
    auditService.log('GIS_IMPORT', 'LOCATION', locationId, 'Import parent area')
  },

  // Import satu LAND PARCEL — asumsi validateGeometry sudah lolos.
  async importParcel(
    locationId: string,
    parcel: MappedParcel,
    createParty: boolean,
  ): Promise<void> {
    requireSupabase()
    const { parcelService } = await import('./parcelService')
    const { partyService } = await import('./partyService')

    const created = await parcelService.create({
      lokasi_id: locationId,
      kode: parcel.kode,
      nomor_bidang: parcel.nomor_bidang,
      luas: parcel.luas,
      jenis_hak: parcel.jenis_hak,
      nomor_hak: parcel.nomor_hak,
      status_pembebasan: parcel.status,
      harga_penawaran: null,
      harga_kesepakatan: null,
      tanggal_kesepakatan: null,
      catatan: 'Hasil import GIS',
    })

    try {
      // Simpan geometry (validasi ulang server-side, termasuk anti-overlap).
      const { mapService } = await import('./mapService')
      await mapService.saveParcelGeometry(created.id, parcel.geometry)
    } catch (error) {
      // Geometry gagal → batalkan parcel agar tidak ada bidang "tanah kosong".
      await parcelService.remove(created.id).catch(() => {})
      throw error
    }

    if (createParty && parcel.namaPihak) {
      try {
        const options = await partyService.listOptions()
        const existing = options.find(
          (option) => option.nama.toLowerCase() === parcel.namaPihak!.toLowerCase(),
        )
        const party =
          existing ??
          (await partyService.create({
            nama: parcel.namaPihak,
            nik: null,
            alamat: null,
            nomor_telepon: null,
            tipe_pihak: 'PEMEGANG_HAK',
            catatan: 'Dibuat otomatis dari import GIS',
          }))
        await partyService.addPartyToParcel({
          parcel_id: created.id,
          party_id: party.id,
          peran: 'Pemilik',
          keterangan: null,
        })
      } catch {
        // Pihak gagal dibuat → import bidang tetap sah; jangan gagalkan import.
      }
    }
    auditService.log('GIS_IMPORT', 'LAND_PARCEL', created.id, parcel.kode)
  },

  // Import REFERENCE LAYER (§18/§25): semua fitur valid (semua tipe geometry
  // — tidak wajib polygon, tidak wajib di dalam parent) di-insert massal.
  // Fitur invalid TIDAK ikut (dilaporkan sebagai Invalid).
  async importReferenceLayer(input: {
    lokasiId: string | null
    jenis: ReferenceLayerKind
    nama: string
    sumber: string
    features: Feature<Geometry, GeoJsonProperties>[]
  }): Promise<number> {
    requireSupabase()
    const valid = input.features.filter((feature) => isFeatureValid(feature))
    if (valid.length === 0) return 0
    const rows = valid.map((feature) => ({
      lokasi_id: input.lokasiId,
      nama: input.nama,
      jenis: input.jenis,
      geometry: feature.geometry,
      properti: (feature.properties ?? {}) as Record<string, unknown>,
      sumber: input.sumber,
    }))
    const { error } = await supabase.from('reference_layers').insert(rows)
    if (error) throw toServiceError(error)
    return valid.length
  },
}

// Jenis reference layer (§18) — contoh daftar dari AGENTS.md.
export const REFERENCE_LAYER_KINDS = [
  'JALAN',
  'SUNGAI',
  'BATAS_DESA',
  'MASTERPLAN',
  'KONTUR',
  'DATA_SURVEY',
  'LAINNYA',
] as const
export type ReferenceLayerKind = (typeof REFERENCE_LAYER_KINDS)[number]

export const REFERENCE_LAYER_KIND_LABELS: Record<ReferenceLayerKind, string> = {
  JALAN: 'Jalan',
  SUNGAI: 'Sungai',
  BATAS_DESA: 'Batas Desa',
  MASTERPLAN: 'Masterplan',
  KONTUR: 'Kontur',
  DATA_SURVEY: 'Data Survey',
  LAINNYA: 'Lainnya',
}

// Rekap hasil import (§25) — termasuk Review Required.
export interface ImportResultCounts {
  imported: number
  skipped: number
  invalid: number
  duplicate: number
  // Lolos validasi client tetapi ditolak validasi server (overlap, di luar
  // parent, dll.) — butuh keputusan manusia sebelum masuk.
  reviewRequired: { index: number; kode: string; reason: string }[]
}
