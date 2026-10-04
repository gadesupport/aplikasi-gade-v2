import type { Geometry, Position } from 'geojson'

// Helper geometry bersama (bbox & center) — dipakai analyze & preview.

export function computeBbox(geometries: (Geometry | null)[]): [number, number, number, number] | null {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  let found = false

  const visit = (position: Position) => {
    const [lng, lat] = position
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
    found = true
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  }
  const walk = (value: unknown) => {
    if (Array.isArray(value) && typeof value[0] === 'number') {
      visit(value as Position)
      return
    }
    if (Array.isArray(value)) value.forEach(walk)
  }
  geometries.forEach((geometry) => {
    if (!geometry) return
    const coordinates = (geometry as { coordinates?: unknown }).coordinates
    walk(coordinates)
  })

  return found ? [minLng, minLat, maxLng, maxLat] : null
}

export function toFeatureCenter(
  geometry: Geometry | null,
): [number, number] | null {
  const bbox = computeBbox(geometry ? [geometry] : [])
  if (!bbox) return null
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
}
