import type { Polygon } from 'geojson'

// Item export GIS (§26) — parent area atau parcel, dalam WGS84.

export type ExportKind = 'PARENT' | 'PARCEL'

export interface ExportItem {
  kind: ExportKind
  kode: string
  nama: string
  nomorBidang: string | null
  luas: number | null
  jenisHak: string | null
  status: string | null
  geometry: Polygon
}

export interface ExportBundle {
  parents: ExportItem[]
  parcels: ExportItem[]
}

export function allItems(bundle: ExportBundle): ExportItem[] {
  return [...bundle.parents, ...bundle.parcels]
}

export type ExportFormat = 'GEOJSON' | 'KML' | 'SHP' | 'DXF'

// Label bidang: kode + nomor bidang + luas (m²) bila tersedia (§26).
export function labelFor(item: {
  kode: string
  nomorBidang: string | null
  luas: number | null
}): string {
  const parts = [item.kode]
  if (item.nomorBidang) parts.push(item.nomorBidang)
  if (item.luas !== null) parts.push(`${item.luas} m2`)
  return parts.filter(Boolean).join(' ')
}
