import { supabase } from '../lib/supabase'
import { requireSupabase, unwrapQuery } from './query'
import { auditService } from './auditService'
import { downloadExport } from '../lib/gis/export'
import type { ExportFormat } from '../lib/gis/export/types'
import type { Polygon } from 'geojson'
import type { ExportBundle, ExportItem } from '../lib/gis/export/types'
import type { ParcelStatus } from '../types/parcel'

// GIS export (§26) — fetch data per scope; tidak mengubah database.

const PARENT_SELECT = 'id, kode, nama, luas_target, geometry'
const PARCEL_SELECT =
  'id, lokasi_id, kode, nomor_bidang, luas, jenis_hak, status_pembebasan, geometry, lokasi:locations(kode, nama)'

interface ParentRow {
  id: string
  kode: string
  nama: string
  luas_target: number | null
  geometry: Polygon
}

interface ParcelRow {
  id: string
  lokasi_id: string
  kode: string
  nomor_bidang: string | null
  luas: number | null
  jenis_hak: string | null
  status_pembebasan: ParcelStatus
  geometry: Polygon
  lokasi: { kode: string; nama: string } | { kode: string; nama: string }[] | null
}
function parentToItem(row: ParentRow): ExportItem {
  return {
    kind: 'PARENT',
    kode: row.kode,
    nama: row.nama,
    nomorBidang: null,
    luas: row.luas_target,
    jenisHak: null,
    status: null,
    geometry: row.geometry,
  }
}

function parcelToItem(row: ParcelRow): ExportItem {
  const lokasi = Array.isArray(row.lokasi) ? (row.lokasi[0] ?? null) : row.lokasi
  return {
    kind: 'PARCEL',
    kode: row.kode,
    nama: lokasi ? `${lokasi.kode} — ${lokasi.nama}` : '',
    nomorBidang: row.nomor_bidang,
    luas: row.luas,
    jenisHak: row.jenis_hak,
    status: row.status_pembebasan,
    geometry: row.geometry,
  }
}

export type ExportScope = 'SEMUA' | 'LOKASI' | 'BIDANG' | 'TERPILIH' | 'FILTER'

export interface ExportScopeParams {
  scope: ExportScope
  lokasiId?: string
  parcelId?: string
  parcelIds?: string[]
  status?: ParcelStatus
}

export const gisExportService = {
  async fetchBundle(params: ExportScopeParams): Promise<ExportBundle> {
    requireSupabase()

    // Bidang berdasarkan scope.
    let parcelsQuery = supabase.from('land_parcels').select(PARCEL_SELECT)
    if (params.scope === 'LOKASI' && params.lokasiId) {
      parcelsQuery = parcelsQuery.eq('lokasi_id', params.lokasiId)
    }
    if (params.scope === 'BIDANG' && params.parcelId) {
      parcelsQuery = parcelsQuery.eq('id', params.parcelId)
    }
    if (params.scope === 'TERPILIH' && params.parcelIds && params.parcelIds.length > 0) {
      parcelsQuery = parcelsQuery.in('id', params.parcelIds)
    }
    if (params.scope === 'FILTER') {
      if (params.lokasiId) parcelsQuery = parcelsQuery.eq('lokasi_id', params.lokasiId)
      if (params.status) parcelsQuery = parcelsQuery.eq('status_pembebasan', params.status)
    }
    const parcels = (await unwrapQuery<ParcelRow[]>(parcelsQuery.limit(5000))) ?? []

    // Parent area: SEMUA (semua lokasi bergeometry), LOKASI (satu), atau
    // lokasi unik dari bidang hasil scope lain.
    let parents: ParentRow[] = []
    let parentsQuery = supabase.from('locations').select(PARENT_SELECT).not('geometry', 'is', null)
    if (params.scope === 'LOKASI' && params.lokasiId) {
      parentsQuery = parentsQuery.eq('id', params.lokasiId)
    } else if (params.scope === 'BIDANG' && params.parcelId) {
      const rows =
        (await unwrapQuery<{ lokasi_id: string }[]>(
          supabase.from('land_parcels').select('lokasi_id').eq('id', params.parcelId).limit(1),
        )) ?? []
      parentsQuery = parentsQuery.in('id', rows.map((row) => row.lokasi_id))
    } else if (params.scope === 'TERPILIH' || params.scope === 'FILTER') {
      const lokasiIds = [...new Set(parcels.map((row) => row.lokasi_id))]
      parentsQuery = lokasiIds.length > 0
        ? parentsQuery.in('id', lokasiIds)
        : parentsQuery.eq('id', '00000000-0000-0000-0000-000000000000')
    }
    parents = (await unwrapQuery<ParentRow[]>(parentsQuery.limit(5000))) ?? []

    return {
      parents: parents.map(parentToItem),
      parcels: parcels.map(parcelToItem),
    }
  },

  // Unduh file export + catat audit GIS_EXPORT (§16/§26).
  async exportBundle(bundle: ExportBundle, format: ExportFormat, scope: string): Promise<string> {
    const fileName = await downloadExport(bundle, format)
    auditService.log(
      'GIS_EXPORT',
      'GIS',
      undefined,
      format + ' — ' + scope + ': ' + bundle.parents.length + ' parent, ' + bundle.parcels.length + ' bidang',
    )
    return fileName
  },
}
