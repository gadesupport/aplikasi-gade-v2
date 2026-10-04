import type { Feature, Geometry } from 'geojson'
import type { ExportBundle } from './types'

// SHP ZIP export (§26) — @mapbox/shp-write (lazy), output ZIP berisi
// .shp/.shx/.dbf/.prj. .prj selalu ditulis (WGS84 WKT). shp-write memisah
// point/polyline/polygon menjadi beberapa shapefile dalam ZIP secara otomatis.

const WGS84_WKT =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["Degree",0.017453292519943295]]'

export async function buildShpZip(bundle: ExportBundle): Promise<Blob> {
  const features: Feature<Geometry>[] = []
  for (const item of [...bundle.parents, ...bundle.parcels]) {
    features.push({
      type: 'Feature',
      properties: {
        JENIS: item.kind,
        KODE: item.kode,
        NAMA: item.nama,
        NO_BIDANG: item.nomorBidang ?? '',
        LUAS: item.luas ?? null,
        JENIS_HAK: item.jenisHak ?? '',
        STATUS: item.status ?? '',
      },
      geometry: item.geometry,
    })
  }

  const { zip } = await import('@mapbox/shp-write')
  const buffer = await zip(
    { type: 'FeatureCollection', features },
    {
      compression: 'DEFLATE',
      outputType: 'blob',
      filename: 'gade-export',
      prj: WGS84_WKT,
    },
  )
  return buffer as unknown as Blob
}
