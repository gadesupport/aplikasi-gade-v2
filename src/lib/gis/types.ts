import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'

// Tipe bersama pipeline GIS import (AGENTS.md §19–§27).

export type GisFormat = 'GEOJSON' | 'KML' | 'SHP' | 'DXF'

export interface GisLayer {
  id: string
  name: string
  features: Feature<Geometry, GeoJsonProperties>[]
  geometryTypes: string[]
  attributes: string[]
  sampleProperties: Record<string, unknown> | null
  bbox: [number, number, number, number] | null
  totalAreaM2: number
}

export type CrsSource = 'metadata' | 'format' | 'user' | 'none'

export interface GisParseResult {
  fileName: string
  format: GisFormat
  layers: GisLayer[]
  // null → tidak terdeteksi; user WAJIB memilih (§27).
  detectedCrs: string | null
  crsSource: CrsSource
  warnings: string[]
}

export interface GisFeatureIssue {
  index: number
  reason: string
}

export interface GisValidation {
  total: number
  invalidCount: number
  issues: GisFeatureIssue[]
  duplicateCodes: string[]
  totalAreaM2: number
}

export function toFeatureCollection(features: Feature<Geometry, GeoJsonProperties>[]): FeatureCollection {
  return { type: 'FeatureCollection', features }
}
