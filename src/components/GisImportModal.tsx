import { useMemo, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import type { FeatureCollection, GeoJsonObject, Polygon } from 'geojson'
import MapView from './MapView'
import type { MapOverlay } from './MapView'
import Badge from './Badge'
import { parseGisFile } from '../lib/gis/parse'
import { COMMON_CRS, reprojectFeature, WGS84 } from '../lib/gis/crs'
import {
  gisImportService,
  applyFieldMapping,
  GADE_FIELDS,
  REFERENCE_LAYER_KINDS,
  REFERENCE_LAYER_KIND_LABELS,
} from '../services/gisImportService'
import type {
  GadeField,
  MappedParcel,
  ImportResultCounts,
  ReferenceLayerKind,
} from '../services/gisImportService'
import { gisTemplateService } from '../services/gisTemplateService'
import { useMappingTemplates } from '../hooks/useMappingTemplates'
import { suggestMapping } from '../lib/gis/autoMap'
import { PARCEL_STATUS_LABELS } from '../types/parcel'
import { formatLuas } from '../lib/format'
import type { GisLayer, GisParseResult } from '../lib/gis/types'

type Step = 1 | 2 | 3 | 4 | 5

const STEP_LABELS: { step: Step; label: string }[] = [
  { step: 1, label: 'Upload' },
  { step: 2, label: 'Analisis & CRS' },
  { step: 3, label: 'Target & Mapping' },
  { step: 4, label: 'Preview & Validasi' },
  { step: 5, label: 'Hasil Import' },
]

type TargetMode = 'PARENT' | 'PARCEL' | 'REFERENCE'

interface GisImportModalProps {
  locationId: string
  locationLabel?: string
  parentGeometry?: Polygon | null
  existingParcels?: FeatureCollection
  onClose: () => void
  onSuccess: () => void
}

const PARENT_OUTLINE_STYLE = { color: '#059669', weight: 2, fill: false, dashArray: '6 4' }
const EXISTING_PARCEL_STYLE = { color: '#64748b', weight: 1, fillColor: '#94a3b8', fillOpacity: 0.15 }

export default function GisImportModal({
  locationId,
  locationLabel,
  parentGeometry,
  existingParcels,
  onClose,
  onSuccess,
}: GisImportModalProps) {
  const [step, setStep] = useState<Step>(1)
  const [parseResult, setParseResult] = useState<GisParseResult | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [confirmedCrs, setConfirmedCrs] = useState<string>(WGS84)

  const [targetMode, setTargetMode] = useState<TargetMode>(parentGeometry ? 'PARCEL' : 'PARENT')
  const [referenceKind, setReferenceKind] = useState<ReferenceLayerKind>('JALAN')
  const [mapping, setMapping] = useState<Record<string, GadeField>>({})
  const [fillLuasFromGeometry, setFillLuasFromGeometry] = useState(true)
  const [autoCreateParty, setAutoCreateParty] = useState(true)

  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [counts, setCounts] = useState<ImportResultCounts | null>(null)

  // Template mapping
  const { templates, reload: reloadTemplates } = useMappingTemplates()
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [isTemplateBusy, setIsTemplateBusy] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)

  const layer: GisLayer | null =
    parseResult?.layers.find((candidate) => candidate.id === selectedLayerId) ?? null

  // CRS konfirmasi != 4326 -> reproyeksikan ke WGS84
  const reprojectedFeatures = useMemo(() => {
    if (!layer) return []
    if (confirmedCrs === WGS84) return layer.features
    return layer.features.map((feature) => reprojectFeature(feature, confirmedCrs))
  }, [layer, confirmedCrs])

  const mappedParcels = useMemo<MappedParcel[]>(() => {
    if (!layer || step < 3) return []
    return applyFieldMapping(reprojectedFeatures, mapping, fillLuasFromGeometry)
  }, [layer, reprojectedFeatures, mapping, fillLuasFromGeometry, step])

  const validation = useMemo(() => {
    const codes = mappedParcels.filter((p) => p.valid).map((p) => p.kode)
    const seen = new Set<string>()
    const duplicateCodes = new Set<string>()
    for (const kode of codes) {
      if (seen.has(kode)) duplicateCodes.add(kode)
      seen.add(kode)
    }
    const issues = mappedParcels
      .filter((parcel) => !parcel.valid)
      .map((parcel) => ({ index: parcel.index, reason: parcel.invalidReason ?? 'Tidak valid.' }))
    const totalAreaM2 = mappedParcels
      .filter((parcel) => parcel.valid)
      .reduce((sum, parcel) => sum + (parcel.luas ?? 0), 0)
    return {
      total: mappedParcels.length,
      invalidCount: issues.length,
      issues,
      duplicateCodes: [...duplicateCodes],
      totalAreaM2,
    }
  }, [mappedParcels])

  // Overlays for MapView during preview
  const previewOverlays = useMemo<MapOverlay[]>(() => {
    const list: MapOverlay[] = []
    if (parentGeometry) {
      list.push({
        geojson: { type: 'Feature', properties: {}, geometry: parentGeometry } as GeoJsonObject,
        style: PARENT_OUTLINE_STYLE,
      })
    }
    if (existingParcels && existingParcels.features.length > 0) {
      list.push({
        geojson: existingParcels,
        style: EXISTING_PARCEL_STYLE,
      })
    }
    return list
  }, [parentGeometry, existingParcels])

  async function processFile(file: File) {
    setIsParsing(true)
    setParseError(null)
    setParseResult(null)
    setCounts(null)
    try {
      const result = await parseGisFile(file)
      setParseResult(result)
      const firstLayer = result.layers[0] ?? null
      setSelectedLayerId(firstLayer?.id ?? null)
      setConfirmedCrs(result.detectedCrs ?? WGS84)
      if (firstLayer && firstLayer.attributes.length > 0) {
        setMapping(suggestMapping(firstLayer.attributes))
      } else {
        setMapping({})
      }
      setStep(2)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Gagal membaca file GIS.')
    } finally {
      setIsParsing(false)
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void processFile(file)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void processFile(file)
  }

  async function handleSaveTemplate() {
    if (!layer || !templateName.trim()) return
    setIsTemplateBusy(true)
    setTemplateError(null)
    try {
      const saved = await gisTemplateService.save(templateName.trim(), mapping)
      setSelectedTemplateId(saved.id)
      setTemplateName('')
      reloadTemplates()
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : 'Gagal menyimpan template mapping.')
    } finally {
      setIsTemplateBusy(false)
    }
  }

  function handleLoadTemplate() {
    if (!layer) return
    const template = templates.find((t) => t.id === selectedTemplateId)
    if (!template) return
    setMapping({ ...suggestMapping(layer.attributes), ...template.mapping })
    setTemplateError(null)
  }

  async function runImport() {
    if (!layer || !locationId) return
    setIsImporting(true)
    setImportError(null)
    setImportProgress('Menyiapkan import…')

    const result: ImportResultCounts = {
      imported: 0,
      skipped: 0,
      invalid: 0,
      duplicate: 0,
      reviewRequired: [],
    }

    try {
      if (targetMode === 'PARENT') {
        setImportProgress('Memvalidasi & menyimpan Batas Induk Lokasi…')
        const firstPolygon = mappedParcels.find((p) => p.valid)
        if (!firstPolygon) {
          throw new Error('Tidak ada polygon valid untuk dijadikan batas lokasi.')
        }
        await gisImportService.importParentArea(locationId, firstPolygon.geometry)
        result.imported = 1
        result.invalid = mappedParcels.filter((p) => !p.valid).length
        result.skipped = Math.max(0, mappedParcels.length - 1 - result.invalid)
      } else if (targetMode === 'REFERENCE') {
        setImportProgress('Menyimpan layer referensi…')
        const imported = await gisImportService.importReferenceLayer({
          lokasiId: locationId || null,
          jenis: referenceKind,
          nama: layer.name,
          sumber: parseResult?.fileName ?? 'import GIS',
          features: reprojectedFeatures,
        })
        result.imported = imported
        result.invalid = reprojectedFeatures.length - imported
      } else {
        setImportProgress('Mengambil data bidang eksisting untuk cek duplikasi…')
        const existingCodes = new Set(await gisImportService.getExistingParcelCodes(locationId))
        const seenInFile = new Set<string>()
        const validParcels = mappedParcels.filter((p) => p.valid)

        for (let i = 0; i < validParcels.length; i++) {
          const parcel = validParcels[i]
          setImportProgress(`Memproses bidang ${i + 1} dari ${validParcels.length} (${parcel.kode})…`)

          if (seenInFile.has(parcel.kode) || existingCodes.has(parcel.kode)) {
            result.duplicate += 1
            continue
          }
          seenInFile.add(parcel.kode)

          try {
            // Validasi server-side SEBELUM insert
            await gisImportService.validateGeometry(locationId, parcel.geometry)
            await gisImportService.importParcel(locationId, parcel, autoCreateParty && Boolean(parcel.namaPihak))
            result.imported += 1
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal mengimpor fitur.'
            if (message.includes('sudah digunakan') || message.includes('sudah ada')) {
              result.duplicate += 1
            } else {
              result.reviewRequired.push({
                index: parcel.index,
                kode: parcel.kode,
                reason: message,
              })
            }
          }
        }
        result.invalid = mappedParcels.filter((p) => !p.valid).length
      }

      setCounts(result)
      setStep(5)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import gagal dilakukan.')
    } finally {
      setIsImporting(false)
      setImportProgress('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Impor Data Spasial GIS (KML & SHP)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Lokasi Target: <span className="font-semibold text-slate-800">{locationLabel ?? locationId}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <span className="sr-only">Tutup</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="border-b border-slate-200 bg-white px-6 py-2.5">
          <ol className="flex flex-wrap items-center gap-2 text-xs">
            {STEP_LABELS.map(({ step: s, label }) => (
              <li key={s} className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition ${
                    step === s
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : step > s
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <span className="font-bold">{s}</span> {label}
                </span>
                {s < 5 && <span className="text-slate-300 font-bold">→</span>}
              </li>
            ))}
          </ol>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {parseError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
              <svg className="h-5 w-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>{parseError}</div>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === 1 && (
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${
                  isDragOver
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-slate-800">
                  Tarik & lepas file data spasial ke sini
                </h3>
                <p className="mt-1 text-sm text-slate-500 max-w-md">
                  Mendukung file <span className="font-semibold text-slate-700">.kml</span>,{' '}
                  <span className="font-semibold text-slate-700">.zip</span> (Shapefile dengan .shp, .shx, .dbf, .prj), atau{' '}
                  <span className="font-semibold text-slate-700">.geojson</span>
                </p>

                <div className="mt-5">
                  <label className="cursor-pointer rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition">
                    Pilih File dari Komputer
                    <input
                      type="file"
                      accept=".kml,.zip,.geojson,.json,.dxf"
                      onChange={handleFileInput}
                      className="hidden"
                      disabled={isParsing}
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <span className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-mono text-slate-600">.KML (Google Earth)</span>
                  <span className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-mono text-slate-600">.ZIP (ESRI Shapefile)</span>
                  <span className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-mono text-slate-600">.GEOJSON</span>
                </div>
              </div>

              {isParsing && (
                <div className="flex items-center justify-center gap-3 py-6 text-sm text-slate-600">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
                  Membaca dan membedah struktur file GIS…
                </div>
              )}
            </div>
          )}

          {/* STEP 2: ANALISIS & CRS */}
          {step === 2 && parseResult && (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{parseResult.fileName}</span>
                    <Badge tone="sky">{parseResult.format}</Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    Ganti File
                  </button>
                </div>
              </div>

              {parseResult.warnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-1">
                    Catatan File
                  </h4>
                  <ul className="list-inside list-disc space-y-1 text-xs text-amber-700">
                    {parseResult.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Layer Selection */}
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Pilih Layer Spasial:</h3>
                <div className="space-y-2">
                  {parseResult.layers.map((cand) => (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => {
                        setSelectedLayerId(cand.id)
                        if (cand.attributes.length > 0) {
                          setMapping(suggestMapping(cand.attributes))
                        }
                      }}
                      className={`w-full rounded-xl border p-4 text-left transition ${
                        cand.id === selectedLayerId
                          ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-slate-900">{cand.name}</span>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone="slate">{cand.features.length} fitur</Badge>
                          <Badge tone="emerald">{cand.geometryTypes.join(', ')}</Badge>
                          <Badge tone="teal">{cand.attributes.length} atribut</Badge>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Luas estimasi: {formatLuas(cand.totalAreaM2)}
                        {cand.bbox ? ` · Bounding Box: [${cand.bbox.map((v) => v.toFixed(3)).join(', ')}]` : ''}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* CRS Detection & Selection */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-800">Sistem Koordinat (CRS):</h3>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-slate-500">Status Deteksi:</span>
                  {parseResult.detectedCrs ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                      ✓ {parseResult.detectedCrs} ({parseResult.crsSource === 'metadata' ? 'dari .prj' : 'spesifikasi format'})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                      ⚠ CRS tidak ada di file (Wajib Dipilih Manual)
                    </span>
                  )}
                </div>

                {!parseResult.detectedCrs && parseResult.format === 'SHP' && (
                  <p className="mt-2 text-xs text-amber-700">
                    File Shapefile ZIP ini tidak menyertakan file <span className="font-mono">.prj</span>. Silakan pilih zona UTM atau sistem proyeksi asal file Anda di bawah ini agar koordinat dikonversi dengan tepat ke WGS84.
                  </p>
                )}

                <div className="mt-3 max-w-md">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Konfirmasi CRS Sumber:
                  </label>
                  <select
                    value={confirmedCrs}
                    onChange={(e) => setConfirmedCrs(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden"
                  >
                    {COMMON_CRS.map((crs) => (
                      <option key={crs.code} value={crs.code}>
                        {crs.label}
                      </option>
                    ))}
                  </select>
                </div>
                {confirmedCrs !== WGS84 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Sistem akan mereproyeksikan koordinat dari <span className="font-semibold">{confirmedCrs}</span> ke <span className="font-semibold">EPSG:4326 (WGS84)</span> secara otomatis.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: TARGET & FIELD MAPPING */}
          {step === 3 && layer && (
            <div className="space-y-6">
              {/* Target Mode Selection */}
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Pilih Target Import untuk Lokasi Ini:</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label
                    className={`cursor-pointer rounded-xl border p-4 text-left transition ${
                      targetMode === 'PARCEL'
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="modalTarget"
                        checked={targetMode === 'PARCEL'}
                        onChange={() => setTargetMode('PARCEL')}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-semibold text-sm text-slate-900">Bidang Tanah (Parcels)</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 pl-6">
                      Setiap fitur menjadi bidang tanah anak di lokasi ini. Melalui validasi spatial (inside parent & no overlap).
                    </p>
                  </label>

                  <label
                    className={`cursor-pointer rounded-xl border p-4 text-left transition ${
                      targetMode === 'PARENT'
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="modalTarget"
                        checked={targetMode === 'PARENT'}
                        onChange={() => setTargetMode('PARENT')}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-semibold text-sm text-slate-900">Batas Induk Lokasi</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 pl-6">
                      Fitur polygon pertama akan disimpan sebagai batas terluar areal lokasi ini.
                    </p>
                  </label>

                  <label
                    className={`cursor-pointer rounded-xl border p-4 text-left transition ${
                      targetMode === 'REFERENCE'
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="modalTarget"
                        checked={targetMode === 'REFERENCE'}
                        onChange={() => setTargetMode('REFERENCE')}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-semibold text-sm text-slate-900">Layer Referensi</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 pl-6">
                      Disimpan sebagai layer peta visual (jalan, sungai, kontur, batas desa) tanpa menjadi bidang.
                    </p>
                  </label>
                </div>

                {!parentGeometry && targetMode === 'PARCEL' && (
                  <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-800 flex items-start gap-3 shadow-xs">
                    <svg className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="font-bold text-sm text-amber-900">Perhatian: Lokasi Ini Belum Memiliki Batas Induk!</p>
                      <p className="mt-1 text-amber-800">
                        Aturan validasi spasial PostGIS mewajibkan setiap bidang tanah berada di dalam batas induk lokasi. Jika file ini adalah batas terluar areal lokasi, silakan pilih opsi target <strong>"Batas Induk Lokasi"</strong> di atas.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Reference layer specific options */}
              {targetMode === 'REFERENCE' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 max-w-md">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori Layer Referensi:
                  </label>
                  <select
                    value={referenceKind}
                    onChange={(e) => setReferenceKind(e.target.value as ReferenceLayerKind)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden"
                  >
                    {REFERENCE_LAYER_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {REFERENCE_LAYER_KIND_LABELS[kind]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Field Mapping Section (for PARCEL mode) */}
              {targetMode === 'PARCEL' && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Pemetaan Atribut (Field Mapping)</h4>
                      <p className="text-xs text-slate-500">Petakan kolom pada file ke kolom data GadeSystem.</p>
                    </div>
                    {layer.attributes.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMapping(suggestMapping(layer.attributes))}
                          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition"
                        >
                          Saran Otomatis
                        </button>
                        <button
                          type="button"
                          onClick={() => setMapping({})}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                        >
                          Kosongkan
                        </button>
                      </div>
                    )}
                  </div>

                  {layer.attributes.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">
                      File ini tidak memiliki atribut dbf/properties. Kode bidang akan di-generate otomatis.
                    </p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Kolom File Sumber</th>
                            <th className="py-2.5 px-3">Target Field GadeSystem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {layer.attributes.map((attr) => (
                            <tr key={attr} className="hover:bg-slate-50">
                              <td className="py-2 px-3">
                                <span className="font-mono font-medium text-slate-800">{attr}</span>
                                {layer.sampleProperties?.[attr] !== undefined && (
                                  <span className="ml-2 text-slate-400">
                                    (contoh: {String(layer.sampleProperties[attr]).slice(0, 20)})
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                <select
                                  value={mapping[attr] ?? ''}
                                  onChange={(e) =>
                                    setMapping((prev) => {
                                      const next = { ...prev }
                                      if (e.target.value === '') delete next[attr]
                                      else next[attr] = e.target.value as GadeField
                                      return next
                                    })
                                  }
                                  className="w-full max-w-xs rounded-md border border-slate-300 py-1 px-2 text-xs focus:border-emerald-500 focus:outline-hidden"
                                >
                                  <option value="">— abaikan (skip) —</option>
                                  {GADE_FIELDS.map((f) => (
                                    <option key={f.key} value={f.key}>
                                      {f.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Options Checkboxes */}
                  <div className="pt-2 space-y-2 text-xs text-slate-700 border-t border-slate-100">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fillLuasFromGeometry}
                        onChange={(e) => setFillLuasFromGeometry(e.target.checked)}
                        className="h-4 w-4 text-emerald-600 rounded-sm"
                      />
                      <span>Hitung otomatis luas dari geometri polygon jika atribut luas tidak dipetakan/kosong</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoCreateParty}
                        onChange={(e) => setAutoCreateParty(e.target.checked)}
                        className="h-4 w-4 text-emerald-600 rounded-sm"
                      />
                      <span>Buat data Pihak/Pemilik otomatis jika field "Nama Pihak/Pemilik" terpetakan dan terisi</span>
                    </label>
                  </div>

                  {/* Template mapping save & load */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-2">
                    <span className="font-semibold text-slate-700">Template Pemetaan:</span>
                    {templateError && <p className="text-red-600">{templateError}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs bg-white"
                      >
                        <option value="">— Pilih template tersimpan —</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nama}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleLoadTemplate}
                        disabled={!selectedTemplateId}
                        className="rounded-md border border-slate-300 px-2.5 py-1 font-medium hover:bg-white disabled:opacity-50"
                      >
                        Terapkan
                      </button>
                      <span className="text-slate-300">|</span>
                      <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="Nama template baru…"
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveTemplate()}
                        disabled={isTemplateBusy || !templateName.trim()}
                        className="rounded-md bg-emerald-600 px-2.5 py-1 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Simpan
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: PREVIEW & VALIDASI */}
          {step === 4 && layer && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="sky">Total: {validation.total}</Badge>
                  <Badge tone="emerald">Valid: {validation.total - validation.invalidCount}</Badge>
                  {validation.invalidCount > 0 && <Badge tone="red">Invalid: {validation.invalidCount}</Badge>}
                  {validation.duplicateCodes.length > 0 && (
                    <Badge tone="amber">Duplikat Kode: {validation.duplicateCodes.length}</Badge>
                  )}
                  <Badge tone="teal">Luas Total: {formatLuas(validation.totalAreaM2)}</Badge>
                </div>
                <span className="text-xs text-slate-500">
                  Target: <span className="font-semibold text-slate-800">{targetMode}</span>
                </span>
              </div>

              {validation.issues.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <p className="font-bold mb-1">Ditemukan Fitur Invalid (akan dilewati):</p>
                  <ul className="list-inside list-disc space-y-0.5">
                    {validation.issues.slice(0, 5).map((issue) => (
                      <li key={issue.index}>
                        Fitur #{issue.index + 1}: {issue.reason}
                      </li>
                    ))}
                    {validation.issues.length > 5 && (
                      <li>… dan {validation.issues.length - 5} fitur lainnya.</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Map Preview */}
              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <MapView
                  geojson={
                    { type: 'FeatureCollection', features: reprojectedFeatures } as FeatureCollection
                  }
                  overlays={previewOverlays}
                  className="h-72 w-full"
                />
              </div>

              {/* Data Table Preview */}
              {targetMode === 'PARCEL' && (
                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Kode</th>
                        <th className="py-2 px-3">No. Bidang</th>
                        <th className="py-2 px-3">Luas</th>
                        <th className="py-2 px-3">Pemilik</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Status Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mappedParcels.slice(0, 15).map((p) => (
                        <tr key={p.index} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 text-slate-400">{p.index + 1}</td>
                          <td className="py-1.5 px-3 font-mono font-medium">{p.kode}</td>
                          <td className="py-1.5 px-3">{p.nomor_bidang ?? '—'}</td>
                          <td className="py-1.5 px-3">{p.luas ? formatLuas(p.luas) : '—'}</td>
                          <td className="py-1.5 px-3">{p.namaPihak ?? '—'}</td>
                          <td className="py-1.5 px-3">{PARCEL_STATUS_LABELS[p.status]}</td>
                          <td className="py-1.5 px-3">
                            {!p.valid ? (
                              <Badge tone="red">Invalid</Badge>
                            ) : validation.duplicateCodes.includes(p.kode) ? (
                              <Badge tone="amber">Duplikat</Badge>
                            ) : (
                              <Badge tone="emerald">Siap</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {importError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <p className="font-bold">Gagal Import:</p>
                  <p>{importError}</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: HASIL IMPORT */}
          {step === 5 && counts && (
            <div className="space-y-5">
              {counts.imported > 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-emerald-900">
                    {counts.imported} Data Berhasil Diimpor!
                  </h3>
                  <p className="mt-1 text-xs text-emerald-700">
                    Data spasial telah disimpan ke database dan siap diterapkan langsung ke peta.
                  </p>

                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    <div className="rounded-xl bg-white border border-emerald-200 px-4 py-2 text-center shadow-xs">
                      <div className="text-xl font-bold text-emerald-600">{counts.imported}</div>
                      <div className="text-xs uppercase text-slate-500 font-medium">Berhasil Masuk</div>
                    </div>
                    {counts.skipped > 0 && (
                      <div className="rounded-xl bg-white border border-slate-200 px-4 py-2 text-center shadow-xs">
                        <div className="text-xl font-bold text-slate-600">{counts.skipped}</div>
                        <div className="text-xs uppercase text-slate-500 font-medium">Dilewati</div>
                      </div>
                    )}
                    {counts.invalid > 0 && (
                      <div className="rounded-xl bg-white border border-red-200 px-4 py-2 text-center shadow-xs">
                        <div className="text-xl font-bold text-red-600">{counts.invalid}</div>
                        <div className="text-xs uppercase text-slate-500 font-medium">Invalid Geometri</div>
                      </div>
                    )}
                    {counts.duplicate > 0 && (
                      <div className="rounded-xl bg-white border border-amber-200 px-4 py-2 text-center shadow-xs">
                        <div className="text-xl font-bold text-amber-600">{counts.duplicate}</div>
                        <div className="text-xs uppercase text-slate-500 font-medium">Duplikat Kode</div>
                      </div>
                    )}
                    {counts.reviewRequired.length > 0 && (
                      <div className="rounded-xl bg-white border border-violet-200 px-4 py-2 text-center shadow-xs">
                        <div className="text-xl font-bold text-violet-600">{counts.reviewRequired.length}</div>
                        <div className="text-xs uppercase text-slate-500 font-medium">Perlu Review</div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-2">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-amber-900">
                    Tidak Ada Data yang Berhasil Disimpan (0 Berhasil)
                  </h3>
                  <p className="mt-1 text-xs text-amber-800 max-w-lg mx-auto">
                    {!parentGeometry && targetMode === 'PARCEL'
                      ? 'Penyebab: Lokasi ini belum memiliki batas induk (parent area). PostGIS menolak bidang tanah jika batas lokasi belum dibuat. Silakan ubah target menjadi "Batas Induk Lokasi" terlebih dahulu.'
                      : 'Data tidak lolos validasi server PostGIS. Silakan periksa rincian penolakan di bawah ini.'}
                  </p>

                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    <div className="rounded-xl bg-white border border-red-200 px-4 py-2 text-center shadow-xs">
                      <div className="text-xl font-bold text-red-600">{counts.invalid}</div>
                      <div className="text-xs uppercase text-slate-500 font-medium">Invalid Geometri</div>
                    </div>
                    {counts.duplicate > 0 && (
                      <div className="rounded-xl bg-white border border-amber-200 px-4 py-2 text-center shadow-xs">
                        <div className="text-xl font-bold text-amber-600">{counts.duplicate}</div>
                        <div className="text-xs uppercase text-slate-500 font-medium">Duplikat Kode</div>
                      </div>
                    )}
                    {counts.reviewRequired.length > 0 && (
                      <div className="rounded-xl bg-white border border-violet-200 px-4 py-2 text-center shadow-xs">
                        <div className="text-xl font-bold text-violet-600">{counts.reviewRequired.length}</div>
                        <div className="text-xs uppercase text-slate-500 font-medium">Ditolak Server</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {counts.reviewRequired.length > 0 && (
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-violet-800 mb-2">
                    Rincian Ditolak Validasi Spasial Server:
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs text-violet-900">
                    {counts.reviewRequired.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 border-b border-violet-100 pb-1">
                        <span className="font-mono font-semibold">{item.kode}:</span>
                        <span className="text-violet-700">{item.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50">
          <div>
            {step > 1 && step < 5 && (
              <button
                type="button"
                onClick={() => setStep((s) => ((s - 1) as Step))}
                disabled={isImporting}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
              >
                ← Kembali
              </button>
            )}
            {step === 5 && counts && counts.imported === 0 && (
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
              >
                ← Ubah Target / Pengaturan
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step < 5 && (
              <button
                type="button"
                onClick={onClose}
                disabled={isImporting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition"
              >
                Batal
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 shadow-xs transition"
              >
                Lanjut ke Target & Mapping →
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={() => setStep(4)}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 shadow-xs transition"
              >
                Lanjut ke Preview →
              </button>
            )}

            {step === 4 && (
              <button
                type="button"
                onClick={() => void runImport()}
                disabled={isImporting || (validation.total - validation.invalidCount === 0)}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>{importProgress || 'Menyimpan…'}</span>
                  </>
                ) : (
                  'Mulai Eksekusi Import'
                )}
              </button>
            )}

            {step === 5 && counts && (
              <button
                type="button"
                onClick={() => {
                  if (counts.imported > 0) {
                    onSuccess()
                  }
                  onClose()
                }}
                className={`rounded-lg px-6 py-2 text-sm font-semibold text-white shadow-xs transition ${
                  counts.imported > 0
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-slate-600 hover:bg-slate-700'
                }`}
              >
                {counts.imported > 0 ? 'Terapkan & Perbarui Peta' : 'Tutup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
