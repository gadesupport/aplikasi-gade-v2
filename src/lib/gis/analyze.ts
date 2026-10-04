import kinks from '@turf/kinks'
import area from '@turf/area'
import type { Feature, GeoJsonProperties, Geometry } from 'geojson'
import { computeBbox } from './geometryHelpers'

// Analisis layer (§20/§23): statistik, bbox, luas total, validitas geometry.

export interface LayerAnalysis {
  geometryTypes: string[]
  attributes: string[]
  sampleProperties: Record<string, unknown> | null
  bbox: [number, number, number, number] | null
  totalAreaM2: number
  invalidCount: number
}

// Validitas ring polygon: minimal 3 titik, koordinat finite,
// tanpa self-intersection fatal.
export function isFeatureValid(feature: Feature<Geometry, GeoJsonProperties>): boolean {
  const geometry = feature.geometry
  if (!geometry) return false
  const rings: number[][][] =
    geometry.type === 'Polygon'
      ? geometry.coordinates
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates.flat()
        : []
  if (rings.length > 0) {
    for (const ring of rings) {
      if (ring.length < 3) return false
    }
  }
  if (!hasFiniteCoordinates((geometry as { coordinates?: unknown }).coordinates)) return false
  if (geometry.type === 'Polygon') {
    try {
      if (kinks(geometry).features.length > 0) return false
    } catch {
      // Abaikan bila error perhitungan turf
    }
  }
  return true
}

function hasFiniteCoordinates(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.every((child) => hasFiniteCoordinates(child))
  }
  return typeof value === 'number' && Number.isFinite(value)
}

export function analyzeFeatures(features: Feature<Geometry, GeoJsonProperties>[]): LayerAnalysis {
  const geometryTypes = new Set<string>()
  const attributes = new Set<string>()
  let sampleProperties: Record<string, unknown> | null = null
  let totalAreaM2 = 0
  let invalidCount = 0

  for (const feature of features) {
    geometryTypes.add(feature.geometry?.type ?? 'UNKNOWN')
    const properties = (feature.properties ?? {}) as Record<string, unknown>
    for (const key of Object.keys(properties)) attributes.add(key)
    if (sampleProperties === null && Object.keys(properties).length > 0) {
      sampleProperties = properties
    }
    if (!isFeatureValid(feature)) {
      invalidCount += 1
      continue
    }
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
      totalAreaM2 += area(feature)
    }
  }

  return {
    geometryTypes: [...geometryTypes],
    attributes: [...attributes],
    sampleProperties,
    bbox: computeBbox(features.map((f) => f.geometry)),
    totalAreaM2,
    invalidCount,
  }
}
