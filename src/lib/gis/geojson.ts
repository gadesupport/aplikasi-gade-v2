import type { Feature, GeoJsonProperties, Geometry } from 'geojson'

// GeoJSON parser (§19): format intermediate internal.

export function parseGeoJson(
  text: string,
  warnings: string[],
): Feature<Geometry, GeoJsonProperties>[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('File GeoJSON tidak valid (JSON tidak dapat dibaca).')
  }

  const features: Feature<Geometry, GeoJsonProperties>[] = []
  collectFeatures(parsed, features, warnings)
  if (features.length === 0) {
    throw new Error('Tidak ada feature ditemukan pada file GeoJSON.')
  }
  return features
}

function collectFeatures(
  node: unknown,
  out: Feature<Geometry, GeoJsonProperties>[],
  warnings: string[],
): void {
  if (Array.isArray(node)) {
    node.forEach((child) => collectFeatures(child, out, warnings))
    return
  }
  if (typeof node !== 'object' || node === null) return
  const record = node as Record<string, unknown>
  const type = record['type']

  if (type === 'FeatureCollection') {
    collectFeatures(record['features'], out, warnings)
    return
  }
  if (type === 'Feature' && record['geometry'] !== null) {
    const geometry = record['geometry'] as Geometry | undefined
    if (!geometry || typeof geometry !== 'object') {
      warnings.push('Feature tanpa geometry dilewati.')
      return
    }
    out.push({
      type: 'Feature',
      properties: (record['properties'] ?? {}) as GeoJsonProperties,
      geometry,
    })
    return
  }
  // Geometry mandiri → dibungkus Feature tanpa properti.
  if (typeof type === 'string' && GEOMETRY_TYPES.includes(type)) {
    out.push({ type: 'Feature', properties: {}, geometry: record as unknown as Geometry })
    return
  }
  // Struktur tak dikenal (mis. TopoJSON) — peringatkan sekali.
  if (type === 'Topology') {
    warnings.push('TopoJSON terdeteksi — konversi ke GeoJSON terlebih dahulu.')
  }
}

const GEOMETRY_TYPES = [
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
]
