import { unzipSync } from 'fflate'
import shp from 'shpjs'
import type { Feature, Geometry } from 'geojson'

// Shapefile ZIP parser (§20): .shp/.shx/.dbf (+ .prj bila ada).
// ZIP di-scan dulu untuk memastikan isi memadai; shpjs menggabungkan
// shape+dbf dan OTOMatis mereproyeksi ke WGS84 bila .prj tersedia.

interface ShpOutput {
  type?: string
  features?: unknown[]
  fileName?: string
}

import { crsFromPrj } from './crs'

// Pre-scan isi ZIP: .shp wajib; .dbf/.shx hilang → peringatan; .prj →
// dicatat sebagai CRS terdeteksi (metadata). Melempar error yang jelas
// bila ZIP bukan shapefile.
export function scanShapefileZip(
  buffer: ArrayBuffer,
  warnings: string[],
): { detectedCrs: string | null } {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(buffer))
  } catch {
    throw new Error('File ZIP tidak dapat dibaca.')
  }
  const names = Object.keys(files).map((name) => name.toLowerCase())
  if (!names.some((name) => name.endsWith('.shp'))) {
    throw new Error('ZIP tidak berisi file .shp — ini bukan shapefile ZIP.')
  }
  if (!names.some((name) => name.endsWith('.dbf'))) {
    warnings.push('File .dbf tidak ditemukan — atribut (field mapping) tidak tersedia.')
  }
  if (!names.some((name) => name.endsWith('.shx'))) {
    warnings.push('File .shx tidak ditemukan — sebagian parser memerlukannya.')
  }
  const prjEntry = names.find((name) => name.endsWith('.prj'))
  if (!prjEntry) {
    warnings.push('File .prj tidak ada — CRS tidak diketahui, tentukan CRS manual pada tahap berikutnya.')
    return { detectedCrs: null }
  }
  // Ekstrak EPSG dari WKT AUTHORITY / nama proyeksi bila ada (dipakai sebagai DETECT CRS).
  const prjText = new TextDecoder().decode(files[prjEntry])
  return { detectedCrs: crsFromPrj(prjText) }
}

export function parseShpZip(buffer: ArrayBuffer): Record<string, Feature<Geometry>[]> {
  let parsed: unknown
  try {
    parsed = shp(buffer)
  } catch {
    throw new Error('Shapefile tidak dapat dibaca dari ZIP. Pastikan .shp/.shx/.dbf lengkap dan valid.')
  }

  const outputs: ShpOutput[] = Array.isArray(parsed) ? (parsed as ShpOutput[]) : [parsed as ShpOutput]
  const result: Record<string, Feature<Geometry>[]> = {}
  let total = 0

  for (const output of outputs) {
    const features = (output.features ?? []).filter(
      (feature): feature is Feature<Geometry> =>
        typeof feature === 'object' &&
        feature !== null &&
        (feature as Feature).geometry !== null &&
        (feature as Feature).geometry !== undefined,
    )
    if (features.length === 0) continue
    const name = output.fileName ?? 'shapefile'
    result[name] = features
    total += features.length
  }

  if (total === 0) {
    throw new Error('Tidak ada feature ditemukan dalam ZIP shapefile.')
  }
  return result
}
