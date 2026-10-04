import type { Geometry, Polygon, Position } from 'geojson'

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

// Memaksa koordinat menjadi 2D [lng, lat] (membuang dimensi Z/elevasi/M).
// PostGIS kolom geometry(Polygon, 4326) menolak data berdimensi Z dengan error:
// "Geometry has Z dimension but column does not"
export function force2DCoordinates(coords: unknown): unknown {
  if (!Array.isArray(coords)) return coords
  if (typeof coords[0] === 'number') {
    return [coords[0], coords[1]]
  }
  return coords.map(force2DCoordinates)
}

export function force2DGeometry<T extends Geometry | null | undefined>(geometry: T): T {
  if (!geometry) return geometry
  if (geometry.type === 'GeometryCollection') {
    return {
      ...geometry,
      geometries: geometry.geometries.map((g) => force2DGeometry(g) as Geometry),
    } as T
  }
  return {
    ...geometry,
    coordinates: force2DCoordinates((geometry as { coordinates?: unknown }).coordinates),
  } as T
}

export function force2DPolygon(polygon: Polygon): Polygon {
  if (!polygon || !polygon.coordinates) return polygon
  return {
    type: 'Polygon',
    coordinates: polygon.coordinates.map((ring: Position[]) =>
      ring.map((pos: Position) => [pos[0], pos[1]] as Position),
    ),
  }
}
