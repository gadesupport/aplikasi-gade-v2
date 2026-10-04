import type { Feature, GeoJsonProperties, Position } from 'geojson'

// KML parser (§21) — WGS84/EPSG:4326 sesuai spesifikasi KML.
// Mendukung: Placemark (name, description, ExtendedData/Data), Point,
// LineString, Polygon (dengan lubang), MultiGeometry.

export function parseKml(text: string, warnings: string[]): Feature[] {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('File KML tidak valid (XML tidak dapat dibaca).')
  }
  const placemarks = [...doc.getElementsByTagName('Placemark')]
  if (placemarks.length === 0) {
    throw new Error('Tidak ada Placemark ditemukan pada file KML.')
  }

  const features: Feature[] = []
  for (const placemark of placemarks) {
    const properties: GeoJsonProperties = {}
    const name = placemark.getElementsByTagName('name')[0]?.textContent?.trim()
    const description = placemark.getElementsByTagName('description')[0]?.textContent?.trim()
    if (name) properties['name'] = name
    if (description) properties['description'] = description
    for (const data of placemark.getElementsByTagName('Data')) {
      const key = data.getAttribute('name')
      const value = data.getElementsByTagName('value')[0]?.textContent?.trim()
      if (key && value) properties[key] = value
    }

    let featureCount = 0
    for (const geometry of placemark.children) {
      if (GEOMETRY_TAGS.includes(geometry.tagName)) {
        const parsedGeometry = parseGeometryNode(geometry)
        if (parsedGeometry) {
          features.push({ type: 'Feature', properties, geometry: parsedGeometry })
          featureCount += 1
        }
      }
    }
    if (featureCount === 0) {
      warnings.push(`Placemark "${name ?? 'tanpa nama'}" tanpa geometry yang didukung — dilewati.`)
    }
  }

  if (features.length === 0) {
    throw new Error('Tidak ada geometry yang dapat dikonversi dari KML.')
  }
  return features
}

const GEOMETRY_TAGS = ['Point', 'LineString', 'Polygon', 'MultiGeometry']

function parseGeometryNode(node: Element): import('geojson').Geometry | null {
  const asGeometry = (value: object) => value as import('geojson').Geometry
  switch (node.tagName) {
    case 'Point':
      return asGeometry({ type: 'Point', coordinates: parseCoordinates(node) })
    case 'LineString':
      return asGeometry({ type: 'LineString', coordinates: parseCoordinates(node) })
    case 'Polygon': {
      const outer = node.getElementsByTagName('outerBoundaryIs')[0]
      if (!outer) return null
      const outerRing = parseCoordinates(outer)
      if (!outerRing || outerRing.length < 4) return null
      const holes = [...node.getElementsByTagName('innerBoundaryIs')]
        .map((hole) => parseCoordinates(hole))
        .filter((ring): ring is Position[] => Boolean(ring) && ring.length >= 4)
      return asGeometry({ type: 'Polygon', coordinates: [outerRing, ...holes] })
    }
    case 'MultiGeometry': {
      const parts: import('geojson').Geometry[] = []
      for (const child of node.children) {
        if (GEOMETRY_TAGS.includes(child.tagName) && child.tagName !== 'MultiGeometry') {
          const part = parseGeometryNode(child)
          if (part) parts.push(part)
        }
      }
      if (parts.length === 0) return null
      if (parts.every((part) => part.type === 'Point')) {
        return asGeometry({
          type: 'MultiPoint',
          coordinates: parts.map((part) => part.coordinates as Position),
        })
      }
      if (parts.every((part) => part.type === 'LineString')) {
        return asGeometry({
          type: 'MultiLineString',
          coordinates: parts.map((part) => part.coordinates as Position[]),
        })
      }
      if (parts.every((part) => part.type === 'Polygon')) {
        return asGeometry({
          type: 'MultiPolygon',
          coordinates: parts.map((part) => part.coordinates as Position[][]),
        })
      }
      // Campuran tipe → ambil polygon pertama bila ada.
      const polygon = parts.find((part) => part.type === 'Polygon')
      return polygon ?? null
    }
    default:
      return null
  }
}

function parseCoordinates(container: Element): Position[] {
  const text =
    container.getElementsByTagName('coordinates')[0]?.textContent?.trim() ??
    container.textContent?.trim() ??
    ''
  return text
    .split(/\s+/)
    .map((triple) => triple.split(',').map(Number))
    .filter(
      (position) =>
        position.length >= 2 && Number.isFinite(position[0]) && Number.isFinite(position[1]),
    )
    .map((position) => [position[0], position[1]] as Position)
}
