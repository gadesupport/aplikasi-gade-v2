import { groupEntitiesByLayer, parseString } from 'dxf'
import type { Feature, Geometry, Position } from 'geojson'

// DXF parser (§22) — CAD entity → GeoJSON. Hanya konversi yang aman:
// POINT, LINE, LWPOLYLINE/POLYLINE (closed → Polygon bila valid),
// CIRCLE (→ polygon aproksimasi), ARC (→ LineString aproksimasi).
// Geometry tidak dapat dikonversi dengan aman TIDAK dikarang — dilewati
// dengan peringatan.

interface CadEntity {
  type: string
  layer?: string
  closed?: boolean
  shape?: boolean
  x?: number
  y?: number
  start?: { x: number; y: number }
  end?: { x: number; y: number }
  center?: { x: number; y: number }
  radius?: number
  startAngle?: number
  endAngle?: number
  vertices?: { x: number; y: number }[]
  points?: { x: number; y: number }[]
}

export function parseDxf(
  text: string,
  warnings: string[],
): Record<string, Feature<Geometry>[]> {
  let parsed: import('dxf').DxfParsed
  try {
    parsed = parseString(text)
  } catch {
    throw new Error('File DXF tidak valid (tidak dapat dibaca).')
  }
  // groupEntitiesByLayer menerima ARRAY entities, bukan objek hasil parse.
  const byLayer = groupEntitiesByLayer(parsed.entities ?? []) as Record<string, CadEntity[]>
  const result: Record<string, Feature<Geometry>[]> = {}
  let converted = 0
  let skipped = 0

  for (const [layerName, entities] of Object.entries(byLayer)) {
    const features: Feature<Geometry>[] = []
    for (const entity of entities) {
      const geometry = convertEntity(entity, warnings, () => (skipped += 1))
      if (geometry) {
        features.push({
          type: 'Feature',
          properties: { layer: layerName, dxfType: entity.type },
          geometry,
        })
        converted += 1
      }
    }
    if (features.length > 0) result[layerName] = features
  }

  if (converted === 0) {
    throw new Error(
      'Tidak ada entity DXF yang dapat dikonversi (didukung: POINT, LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC).',
    )
  }
  return result
}

function convertEntity(
  entity: CadEntity,
  warnings: string[],
  onSkip: () => void,
): import('geojson').Geometry | null {
  switch (entity.type) {
    // dxf v5: POINT menyimpan koordinat langsung di x/y.
    case 'POINT': {
      const position = positionOf(
        entity.x !== undefined ? { x: entity.x, y: entity.y ?? NaN } : undefined,
      )
      return position ? { type: 'Point', coordinates: position } : skip()
    }
    case 'LINE': {
      const start = positionOf(entity.start)
      const end = positionOf(entity.end)
      if (!start || !end) return skip()
      return { type: 'LineString', coordinates: [start, end] }
    }
    case 'LWPOLYLINE':
    case 'POLYLINE': {
      const raw = entity.vertices ?? entity.points ?? []
      // Sanitasi: buang koordinat non-finite dan vertex duplikat berurutan
      // agar polygon "closed" benar-benar aman sebelum dikonversi.
      const ring = raw
        .map((vertex) => [vertex.x, vertex.y] as Position)
        .filter(isFinitePosition)
        .filter(
          (position, index, all) =>
            index === 0 || position[0] !== all[index - 1][0] || position[1] !== all[index - 1][1],
        )
      if (ring.length < 2) return skip()
      // Closed polyline → polygon HANYA bila aman: minimal 3 titik unik.
      // dxf v5 memakai `closed` (POLYLINE lama: `shape`).
      if ((entity.closed || entity.shape) && ring.length >= 3) {
        const closed = closeRing(ring)
        return { type: 'Polygon', coordinates: [closed] }
      }
      // Tidak aman sebagai polygon → dipertahankan sebagai garis (bukan
      // dikarang); kelayakan akhir ditentukan validasi (analyze/DB).
      return { type: 'LineString', coordinates: ring }
    }
    case 'CIRCLE': {
      if (!entity.center || !entity.radius || entity.radius <= 0) return skip()
      return {
        type: 'Polygon',
        coordinates: [closeRing(circlePoints(entity.center, entity.radius, 0, Math.PI * 2))],
      }
    }
    case 'ARC': {
      if (!entity.center || !entity.radius) return skip()
      const start = entity.startAngle ?? 0
      const end = entity.endAngle ?? Math.PI * 2
      if (end <= start) return skip()
      const line = circlePoints(entity.center, entity.radius, start, end)
      if (line.length < 2) return skip()
      return { type: 'LineString', coordinates: line }
    }
    default: {
      warnings.push(`Entity DXF "${entity.type}" dilewati (belum didukung).`)
      onSkip()
      return null
    }
  }

  function skip(): null {
    onSkip()
    return null
  }
}

function positionOf(vertex: { x: number; y: number } | undefined): Position | null {
  if (!vertex || !Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)) return null
  return [vertex.x, vertex.y]
}

function isFinitePosition(position: Position): boolean {
  return Number.isFinite(position[0]) && Number.isFinite(position[1])
}

function closeRing(ring: Position[]): Position[] {
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] === last[0] && first[1] === last[1]) return ring
  return [...ring, first]
}

function circlePoints(
  center: { x: number; y: number },
  radius: number,
  startAngle: number,
  endAngle: number,
): Position[] {
  const segments = 64
  const span = endAngle - startAngle
  const points: Position[] = []
  for (let i = 0; i <= segments; i += 1) {
    const angle = startAngle + (span * i) / segments
    points.push([center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle)])
  }
  return points
}
