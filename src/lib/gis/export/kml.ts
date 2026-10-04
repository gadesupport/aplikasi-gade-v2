import type { ExportBundle } from './types'
import { labelFor } from './types'

// KML export (§26) — KML 2.2, WGS84/EPSG:4326 (spesifikasi KML).
// Folder: PARENT AREA & LAND PARCEL; label = kode (+nomor bidang + luas).

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function coordinatesToText(ring: number[][]): string {
  return ring.map(([lng, lat]) => `${lng},${lat},0`).join(' ')
}

function polygonToKmlGeometry(item: { geometry: { coordinates: number[][][] } }): string {
  const outer = item.geometry.coordinates[0]
  const holes = item.geometry.coordinates.slice(1)
  const boundary = (ring: number[][]) =>
    `<boundaryIs><LinearRing><coordinates>${coordinatesToText(ring)}</coordinates></LinearRing></boundaryIs>`
  return [
    '<Polygon>',
    '<tessellate>1</tessellate>',
    boundary(outer),
    ...holes.map(boundary),
    '</Polygon>',
  ].join('')
}

function placemark(kind: string, item: { kode: string; nama: string; nomorBidang: string | null; luas: number | null; jenisHak: string | null; status: string | null; geometry: { coordinates: number[][][] } }): string {
  const description = [
    `Kode: ${item.kode}`,
    item.nomorBidang ? `Nomor Bidang: ${item.nomorBidang}` : null,
    item.luas !== null ? `Luas: ${item.luas} m2` : null,
    item.jenisHak ? `Jenis Hak: ${item.jenisHak}` : null,
    item.status ? `Status: ${item.status}` : null,
  ]
    .filter((line): line is string => line !== null)
    .map(escapeXml)
    .join('&lt;br/&gt;')
  return [
    '<Placemark>',
    `<name>${escapeXml(labelFor(item))}</name>`,
    `<description>${description}</description>`,
    `<ExtendedData><Data name="jenis"><value>${kind}</value></Data></ExtendedData>`,
    polygonToKmlGeometry(item),
    '</Placemark>',
  ].join('')
}

export function buildKml(bundle: ExportBundle): string {
  const folder = (name: string, items: { kind: string; kode: string; nama: string; nomorBidang: string | null; luas: number | null; jenisHak: string | null; status: string | null; geometry: { coordinates: number[][][] } }[]) =>
    items.length === 0
      ? ''
      : ['<Folder>', `<name>${name}</name>`, ...items.map((item) => placemark(item.kind, item)), '</Folder>'].join('')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    '<Document>',
    '<name>GadeSystem Export</name>',
    folder('PARENT AREA', bundle.parents),
    folder('LAND PARCEL', bundle.parcels),
    '</Document>',
    '</kml>',
  ].join('')
}
