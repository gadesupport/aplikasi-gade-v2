import type { Feature, GeoJsonProperties, Geometry } from 'geojson'
import { parseGeoJson } from './geojson'
import { parseKml } from './kml'
import { parseDxf } from './dxf'
import { scanShapefileZip, parseShpZip } from './shapefile'
import { analyzeFeatures } from './analyze'
import { COMMON_CRS } from './crs'
import type { GisFormat, GisLayer, GisParseResult } from './types'

// Dispatcher parser + ANALYZE (§19 tahap 2). Semua format dinormalisasi
// menjadi GeoJSON intermediate, dikelompokkan per layer, lalu dianalisis.

export async function parseGisFile(file: File): Promise<GisParseResult> {
  const format = detectFormat(file.name)
  const warnings: string[] = []
  let layers: Record<string, Feature<Geometry, GeoJsonProperties>[]> = {}
  let detectedCrs: string | null = null
  let crsSource: GisParseResult['crsSource'] = 'none'

  if (format === 'GEOJSON') {
    layers = { [stripExtension(file.name)]: parseGeoJson(await file.text(), warnings) }
    // RFC 7946: GeoJSON selalu WGS84. Properti CRS lama (pre-RFC) diabaikan
    // dengan peringatan — user dapat memaksa CRS lain pada tahap CONFIRM.
    detectedCrs = 'EPSG:4326'
    crsSource = 'format'
  } else if (format === 'KML') {
    layers = { [stripExtension(file.name)]: parseKml(await file.text(), warnings) }
    // Spesifikasi KML: WGS84.
    detectedCrs = 'EPSG:4326'
    crsSource = 'format'
  } else if (format === 'SHP') {
    // Pre-scan isi ZIP (.shp wajib, .prj → DETECT CRS; .dbf/.shx hilang →
    // peringatan) lalu parse; shpjs sudah mereproyeksi bila prj ada (§20).
    const buffer = await file.arrayBuffer()
    const scan = scanShapefileZip(buffer, warnings)
    layers = parseShpZip(buffer)
    if (scan.detectedCrs) {
      detectedCrs = scan.detectedCrs
      crsSource = 'metadata'
      warnings.push(
        `PRJ: ${scan.detectedCrs} — shpjs telah mereproyeksi koordinat ke WGS84. Konfirmasi CRS hanya mencatat asal data.`,
      )
    }
  } else {
    layers = parseDxf(await file.text(), warnings)
    // DXF tidak membawa CRS → WAJIB user memilih (§22/§27).
  }

  const analyzed: GisLayer[] = Object.entries(layers).map(([name, features], index) => {
    const analysis = analyzeFeatures(features)
    return {
      id: `layer-${index}`,
      name,
      features,
      geometryTypes: analysis.geometryTypes,
      attributes: analysis.attributes,
      sampleProperties: analysis.sampleProperties,
      bbox: analysis.bbox,
      totalAreaM2: analysis.totalAreaM2,
    }
  })

  return {
    fileName: file.name,
    format,
    layers: analyzed,
    detectedCrs,
    crsSource,
    warnings: [
      ...warnings,
      ...(detectedCrs === null
        ? ['CRS tidak terdeteksi dari file — pilih CRS pada tahap berikutnya.']
        : []),
    ],
  }
}

function detectFormat(fileName: string): GisFormat {
  const extension = fileName.toLowerCase().split('.').pop() ?? ''
  if (extension === 'geojson' || extension === 'json') return 'GEOJSON'
  if (extension === 'kml') return 'KML'
  if (extension === 'zip') return 'SHP'
  if (extension === 'dxf') return 'DXF'
  throw new Error(
    'Format tidak dikenal. Gunakan GeoJSON (.geojson/.json), KML (.kml), Shapefile ZIP (.zip), atau DXF (.dxf).',
  )
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

export { COMMON_CRS }
