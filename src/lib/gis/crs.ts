import proj4 from 'proj4'
import type { Feature, GeoJsonProperties, Geometry, Position } from 'geojson'

// CRS (§27): deteksi metadata → format → user. Reprojection ke EPSG:4326
// sebelum analisis/penyimpanan bila CRS bukan 4326.

export const WGS84 = 'EPSG:4326'

// Daftar CRS umum Indonesia — inisialisasi UTM WGS84 untuk seluruh wilayah Indonesia.
for (let zone = 46; zone <= 54; zone++) {
  proj4.defs(
    `EPSG:${32700 + zone}`,
    `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs`,
  )
  proj4.defs(
    `EPSG:${32600 + zone}`,
    `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`,
  )
}

export const COMMON_CRS: { code: string; label: string }[] = [
  { code: 'EPSG:4326', label: 'WGS84 (EPSG:4326)' },
  { code: 'EPSG:3857', label: 'Web Mercator (EPSG:3857)' },
  ...Array.from({ length: 9 }, (_, i) => {
    const zone = 46 + i
    return {
      code: `EPSG:${32700 + zone}`,
      label: `WGS 84 / UTM Zona ${zone}S (EPSG:${32700 + zone})`,
    }
  }),
  ...Array.from({ length: 9 }, (_, i) => {
    const zone = 46 + i
    return {
      code: `EPSG:${32600 + zone}`,
      label: `WGS 84 / UTM Zona ${zone}N (EPSG:${32600 + zone})`,
    }
  }),
]

// Ekstrak EPSG dari isi file .prj (WKT) bila memuat AUTHORITY atau nama proyeksi.
export function crsFromPrj(prj: string): string | null {
  const authorityMatch = prj.match(/AUTHORITY\["EPSG","(\d+)"\]/i)
  if (authorityMatch) return `EPSG:${authorityMatch[1]}`

  const utmSouth = prj.match(/UTM\s*zone\s*(\d+)\s*(S|south)/i)
  if (utmSouth) return `EPSG:${32700 + parseInt(utmSouth[1], 10)}`

  const utmNorth = prj.match(/UTM\s*zone\s*(\d+)\s*(N|north)/i)
  if (utmNorth) return `EPSG:${32600 + parseInt(utmNorth[1], 10)}`

  return null
}

// Reproyeksi semua posisi pada geometry ke EPSG:4326.
function reprojectPosition(from: string, position: Position): Position {
  const [x, y, ...rest] = position
  const [lng, lat] = proj4(from, WGS84, [x, y])
  return rest.length > 0 ? [lng, lat, ...rest] : [lng, lat]
}

function reprojectCoordinates(from: string, coordinates: unknown): unknown {
  if (Array.isArray(coordinates) && typeof coordinates[0] === 'number') {
    return reprojectPosition(from, coordinates as Position)
  }
  if (Array.isArray(coordinates)) {
    return coordinates.map((child) => reprojectCoordinates(from, child))
  }
  return coordinates
}

export function reprojectFeature(
  feature: Feature<Geometry, GeoJsonProperties>,
  from: string,
): Feature<Geometry, GeoJsonProperties> {
  if (from === WGS84) return feature
  const raw = feature.geometry as unknown as { coordinates?: unknown }
  return {
    ...feature,
    geometry: {
      ...feature.geometry,
      coordinates: reprojectCoordinates(from, raw.coordinates),
    } as Geometry,
  }
}
