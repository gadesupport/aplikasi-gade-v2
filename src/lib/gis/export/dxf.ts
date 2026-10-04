import type { ExportBundle, ExportItem } from './types'
import { labelFor } from './types'

// DXF export (§26) — ASCII DXF (AC1015/R2000) dengan layer:
//   GADE_PARENT  : polygon batas induk lokasi
//   GADE_PARCEL  : polygon bidang
//   GADE_BOUNDARY: garis ring bidang (closed polyline)
//   GADE_POINT   : titik tengah bidang (aproksimasi centroid ring)
//   GADE_LABEL   : TEXT kode bidang + nomor bidang + luas
// Koordinat ditulis dalam derajat WGS84 (DXF tidak punya CRS standar).

const RING = (layer: string, ring: number[][], closed: boolean): string => {
  const lines = [`0`, `LWPOLYLINE`, `8`, layer, `90`, String(ring.length), `70`, closed ? `1` : `0`]
  for (const [x, y] of ring) {
    lines.push(`10`, x.toFixed(8), `20`, y.toFixed(8))
  }
  return lines.join(`\n`)
}

const TEXT = (layer: string, x: number, y: number, height: number, text: string): string =>
  [`0`, `TEXT`, `8`, layer, `10`, x.toFixed(8), `20`, y.toFixed(8), `40`, String(height), `1`, text].join(`\n`)

function ringOf(item: ExportItem): number[][] {
  return item.geometry.coordinates[0]
}

function centroidOf(ring: number[][]): [number, number] {
  // Aproksimasi centroid: rata-rata titik ring (tanpa titik penutup duplikat).
  const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring
  const sum = pts.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0])
  return [sum[0] / pts.length, sum[1] / pts.length]
}

export function buildDxf(bundle: ExportBundle): string {
  const entities: string[] = []

  for (const parent of bundle.parents) {
    entities.push(RING('GADE_PARENT', ringOf(parent), true))
  }
  for (const parcel of bundle.parcels) {
    entities.push(RING('GADE_PARCEL', ringOf(parcel), true))
    // Boundary: ring tanpa penutup eksplisit pada layer terpisah.
    const ring = ringOf(parcel)
    const openRing = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring
    entities.push(RING('GADE_BOUNDARY', openRing, false))
    const [cx, cy] = centroidOf(ring)
    entities.push(
      [`0`, `POINT`, `8`, `GADE_POINT`, `10`, cx.toFixed(8), `20`, cy.toFixed(8)].join(`\n`),
    )
    // Label: kode + nomor bidang + luas bila sesuai (§26).
    const label = labelFor(parcel)
    if (label) {
      entities.push(TEXT('GADE_LABEL', cx, cy, 0.00008, label))
    }
  }

  return [
    `0`, `SECTION`, `2`, `HEADER`,
    `9`, `$ACADVER`, `1`, `AC1015`,
    `0`, `ENDSEC`,
    `0`, `SECTION`, `2`, `ENTITIES`,
    ...entities,
    `0`, `ENDSEC`,
    `0`, `EOF`,
    ``,
  ].join(`\n`)
}
