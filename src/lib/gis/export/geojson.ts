import type { Feature, Geometry } from 'geojson'
import type { ExportBundle } from './types'

// GeoJSON export (§26) — RFC 7946 (WGS84), properti lengkap per fitur.

export function buildGeoJson(bundle: ExportBundle): string {
  const features: Feature<Geometry>[] = []
  for (const item of [...bundle.parents, ...bundle.parcels]) {
    features.push({
      type: 'Feature',
      properties: {
        jenis: item.kind,
        kode: item.kode,
        nama: item.nama,
        nomor_bidang: item.nomorBidang,
        luas_m2: item.luas,
        jenis_hak: item.jenisHak,
        status: item.status,
      },
      geometry: item.geometry,
    })
  }
  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2)
}
