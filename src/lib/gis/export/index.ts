import { buildGeoJson } from './geojson'
import { buildKml } from './kml'
import { buildDxf } from './dxf'
import { buildShpZip } from './shp'
import type { ExportBundle, ExportFormat } from './types'

export type { ExportFormat } from './types'

export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function downloadExport(bundle: ExportBundle, format: ExportFormat): Promise<string> {
  const stamp = new Date().toISOString().slice(0, 10)
  switch (format) {
    case 'GEOJSON': {
      const blob = new Blob([buildGeoJson(bundle)], { type: 'application/geo+json' })
      saveBlob(blob, `gade-export-${stamp}.geojson`)
      return `gade-export-${stamp}.geojson`
    }
    case 'KML': {
      const blob = new Blob([buildKml(bundle)], { type: 'application/vnd.google-earth.kml+xml' })
      saveBlob(blob, `gade-export-${stamp}.kml`)
      return `gade-export-${stamp}.kml`
    }
    case 'SHP': {
      const blob = await buildShpZip(bundle)
      saveBlob(blob, `gade-export-${stamp}.zip`)
      return `gade-export-${stamp}.zip`
    }
    case 'DXF': {
      const blob = new Blob([buildDxf(bundle)], { type: 'application/dxf' })
      saveBlob(blob, `gade-export-${stamp}.dxf`)
      return `gade-export-${stamp}.dxf`
    }
  }
}
