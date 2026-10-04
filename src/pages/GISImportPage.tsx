import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import MapView from '../components/MapView'
import Badge from '../components/Badge'
import { parseGisFile } from '../lib/gis/parse'
import { COMMON_CRS, reprojectFeature, WGS84 } from '../lib/gis/crs'
import { gisImportService, applyFieldMapping, GADE_FIELDS, REFERENCE_LAYER_KINDS, REFERENCE_LAYER_KIND_LABELS } from '../services/gisImportService'
import type { GadeField, MappedParcel, ImportResultCounts, ReferenceLayerKind } from '../services/gisImportService'
import { locationService } from '../services/locationService'
import { gisTemplateService } from '../services/gisTemplateService'
import { useMappingTemplates } from '../hooks/useMappingTemplates'
import { suggestMapping } from '../lib/gis/autoMap'
import { PARCEL_STATUS_LABELS } from '../types/parcel'
import { formatLuas } from '../lib/format'
import type { GisLayer, GisParseResult } from '../lib/gis/types'

type Step = 1 | 2 | 3 | 4 | 5 | 6

const STEP_LABELS: { step: Step; label: string }[] = [
  { step: 1, label: 'Upload' },
  { step: 2, label: 'Layer' },
  { step: 3, label: 'CRS' },
  { step: 4, label: 'Field Mapping' },
  { step: 5, label: 'Preview & Validasi' },
  { step: 6, label: 'Target & Import' },
]

type TargetMode = 'PARENT' | 'PARCEL' | 'REFERENCE'

export default function GISImportPage() {
  const [searchParams] = useSearchParams()
  const initialLocation = searchParams.get('lokasi') || searchParams.get('locationId') || ''

  const [step, setStep] = useState<Step>(1)
  const [parseResult, setParseResult] = useState<GisParseResult | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [confirmedCrs, setConfirmedCrs] = useState<string>(WGS84)
  const [mapping, setMapping] = useState<Record<string, GadeField>>({})
  const [fillLuasFromGeometry, setFillLuasFromGeometry] = useState(true)
  const [targetMode, setTargetMode] = useState<TargetMode>('PARCEL')
  const [locationId, setLocationId] = useState(initialLocation)
  const [referenceKind, setReferenceKind] = useState<ReferenceLayerKind>('JALAN')
  const [locationOptions, setLocationOptions] = useState<{ id: string; kode: string; nama: string }[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [counts, setCounts] = useState<ImportResultCounts | null>(null)

  // Template mapping (§24) + saran otomatis.
  const { templates, reload: reloadTemplates } = useMappingTemplates()
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [isTemplateBusy, setIsTemplateBusy] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    locationService
      .listOptions()
      .then((options) => {
        if (active) setLocationOptions(options)
      })
      .catch(() => {
        // Dropdown lokasi wajib untuk import; error tampil saat memilih.
      })
    return () => {
      active = false
    }
  }, [])

  const layer: GisLayer | null =
    parseResult?.layers.find((candidate) => candidate.id === selectedLayerId) ?? null

  // CRS konfirmasi ≠ 4326 → reproyeksikan fitur layer ke WGS84 (§27).
  const reprojectedFeatures = useMemo(() => {
    if (!layer) return []
    if (confirmedCrs === WGS84) return layer.features
    return layer.features.map((feature) => reprojectFeature(feature, confirmedCrs))
  }, [layer, confirmedCrs])

  const mappedParcels = useMemo<MappedParcel[]>(() => {
    if (!layer || step < 5) return []
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

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
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
    if (!layer) return
    setIsTemplateBusy(true)
    setTemplateError(null)
    try {
      const saved = await gisTemplateService.save(templateName, mapping)
      setSelectedTemplateId(saved.id)
      setTemplateName('')
      reloadTemplates()
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : 'Gagal menyimpan template.')
    } finally {
      setIsTemplateBusy(false)
    }
  }

  function handleLoadTemplate() {
    if (!layer) return
    const template = templates.find((candidate) => candidate.id === selectedTemplateId)
    if (!template) return
    // Template di-merge di atas saran otomatis (field yang tidak ada di
    // template tetap tercari bila cocok).
    setMapping({ ...suggestMapping(layer.attributes), ...template.mapping })
    setTemplateError(null)
  }

  async function handleDeleteTemplate() {
    if (!selectedTemplateId) return
    const template = templates.find((candidate) => candidate.id === selectedTemplateId)
    if (!template) return
    if (!window.confirm(`Hapus template "${template.nama}"?`)) return
    setIsTemplateBusy(true)
    setTemplateError(null)
    try {
      await gisTemplateService.remove(selectedTemplateId)
      setSelectedTemplateId('')
      reloadTemplates()
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : 'Gagal menghapus template.')
    } finally {
      setIsTemplateBusy(false)
    }
  }

  async function runImport() {
    if (!layer || !locationId) return
    setIsImporting(true)
    setImportError(null)
    const result: ImportResultCounts = {
      imported: 0,
      skipped: 0,
      invalid: 0,
      duplicate: 0,
      reviewRequired: [],
    }
    try {
      if (targetMode === 'PARENT') {
        const firstPolygon = mappedParcels.find((parcel) => parcel.valid)
        if (!firstPolygon) {
          throw new Error('Tidak ada polygon valid untuk dijadikan batas lokasi.')
        }
        await gisImportService.importParentArea(locationId, firstPolygon.geometry)
        result.imported = 1
        result.skipped = mappedParcels.length - 1
        result.invalid = mappedParcels.filter((parcel) => !parcel.valid).length
        result.skipped = mappedParcels.length - 1 - result.invalid
      } else if (targetMode === 'REFERENCE') {
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
        const existingCodes = new Set(await gisImportService.getExistingParcelCodes(locationId))
        const seenInFile = new Set<string>()
        for (const parcel of mappedParcels) {
          if (!parcel.valid) {
            result.invalid += 1
            continue
          }
          if (seenInFile.has(parcel.kode) || existingCodes.has(parcel.kode)) {
            result.duplicate += 1
            continue
          }
          seenInFile.add(parcel.kode)
          try {
            // Validasi server-side SEBELUM insert (§25 — jangan insert dulu):
            // geometry valid + inside parent + tanpa overlap.
            await gisImportService.validateGeometry(locationId, parcel.geometry)
            await gisImportService.importParcel(locationId, parcel, Boolean(parcel.namaPihak))
            result.imported += 1
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal mengimpor fitur.'
            // Duplikat yang lolos ke insert (race) tetap terhitung Duplicate.
            if (message.includes('sudah digunakan') || message.includes('sudah ada')) {
              result.duplicate += 1
            } else {
              // Overlap / di luar parent / validasi lain → butuh review.
              result.reviewRequired.push({ index: parcel.index, kode: parcel.kode, reason: message })
            }
          }
        }
      }
      setCounts(result)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import gagal.')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/peta" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
          ← Kembali ke Peta
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Impor GIS</h1>
        <p className="mt-1 text-sm text-slate-500">
          GeoJSON · KML · Shapefile ZIP · DXF — dinormalisasi ke GeoJSON; tidak ada data tersimpan
          sebelum validasi (AGENTS.md §19–§27).
        </p>
      </div>

      {/* Stepper */}
      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {STEP_LABELS.map(({ step: s, label }) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
                step === s
                  ? 'bg-emerald-600 text-white'
                  : step > s
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              <span className="font-bold">{s}</span> {label}
            </span>
            {s < 6 && <span className="text-slate-300">→</span>}
          </li>
        ))}
      </ol>

      {parseError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {parseError}
        </div>
      )}

      {/* 1. UPLOAD */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">1. Upload File</h2>
          {parseResult && (
            <label className="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Ganti File
              <input
                type="file"
                accept=".geojson,.json,.kml,.zip,.dxf"
                onChange={(event) => void handleFileChange(event)}
                className="hidden"
                disabled={isParsing}
              />
            </label>
          )}
        </div>

        {!parseResult && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
              isDragOver
                ? 'border-emerald-500 bg-emerald-50/50'
                : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-800">
              Tarik & lepas file data spasial ke sini
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Mendukung KML (.kml), Shapefile ZIP (.zip), GeoJSON (.geojson), atau DXF (.dxf)
            </p>
            <label className="mt-4 cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition">
              Pilih File
              <input
                type="file"
                accept=".geojson,.json,.kml,.zip,.dxf"
                onChange={(event) => void handleFileChange(event)}
                className="hidden"
                disabled={isParsing}
              />
            </label>
          </div>
        )}

        {parseResult && (
          <p className="text-sm text-slate-600">
            <span className="font-medium">{parseResult.fileName}</span>{' '}
            <Badge tone="sky">{parseResult.format}</Badge>{' '}
            {parseResult.layers.length} layer ·{' '}
            {parseResult.layers.reduce((sum, l) => sum + l.features.length, 0)} fitur
          </p>
        )}
        {isParsing && <p className="text-sm text-slate-500">Menganalisis file…</p>}
      </div>

      {/* 2. ANALYZE + SELECT LAYER */}
      {parseResult && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">2. Analisis & Pilih Layer</h2>
          {parseResult.warnings.length > 0 && (
            <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-amber-700">
              {parseResult.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 space-y-2">
            {parseResult.layers.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => {
                  setSelectedLayerId(candidate.id)
                  setStep(3)
                }}
                className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                  candidate.id === selectedLayerId
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-medium text-slate-900">{candidate.name}</p>
                <p className="text-xs text-slate-500">
                  {candidate.features.length} fitur · {candidate.geometryTypes.join(', ')} ·{' '}
                  {candidate.attributes.length} atribut · luas ≈{' '}
                  {formatLuas(candidate.totalAreaM2)}
                  {candidate.bbox ? ` · bbox [${candidate.bbox.map((v) => v.toFixed(3)).join(', ')}]` : ''}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. DETECT + CONFIRM CRS */}
      {layer && step >= 3 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">3. CRS</h2>
          <p className="mt-1 text-sm text-slate-500">
            Terdeteksi:{' '}
            {parseResult?.detectedCrs ? (
              <span className="font-medium text-slate-900">
                {parseResult.detectedCrs}{' '}
                {parseResult.crsSource === 'format' && '(dari spesifikasi format)'}
                {parseResult.crsSource === 'metadata' && '(dari metadata PRJ)'}
              </span>
            ) : (
              <span className="font-medium text-amber-700">tidak terdeteksi</span>
            )}
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Konfirmasi CRS sumber
              </label>
              <select
                value={confirmedCrs}
                onChange={(event) => setConfirmedCrs(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {COMMON_CRS.map((crs) => (
                  <option key={crs.code} value={crs.code}>
                    {crs.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Lanjut
            </button>
          </div>
          {confirmedCrs !== WGS84 && (
            <p className="mt-2 text-xs text-amber-700">
              Koordinat akan direproyeksi {confirmedCrs} → WGS84 sebelum analisis & import.
            </p>
          )}
        </div>
      )}

      {/* 4. FIELD MAPPING */}
      {layer && step >= 4 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">4. Field Mapping (source → GADE)</h2>

          {/* Info layer: geometry type, CRS, feature count, bbox, luas */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="sky">{layer.geometryTypes.join(', ')}</Badge>
            <Badge tone="violet">CRS: {confirmedCrs}</Badge>
            <Badge tone="slate">{layer.features.length} fitur</Badge>
            <Badge tone="teal">{layer.attributes.length} atribut</Badge>
            <Badge tone="emerald">Luas ≈ {formatLuas(layer.totalAreaM2)}</Badge>
            {layer.bbox && (
              <Badge tone="amber">bbox [{layer.bbox.map((v) => v.toFixed(3)).join(', ')}]</Badge>
            )}
          </div>

          {layer.attributes.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Layer ini tidak memiliki atribut — kode bidang akan dibuat otomatis.
            </p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMapping((prev) => ({ ...suggestMapping(layer.attributes), ...prev }))}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  Saran Otomatis
                </button>
                <button
                  type="button"
                  onClick={() => setMapping({})}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Kosongkan
                </button>
                <span className="text-xs text-slate-400">
                  Pilih "— abaikan —" untuk melewati field (skip).
                </span>
              </div>

              {/* Tabel source field → target field */}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <th className="py-2 pr-4 font-medium">Source Field</th>
                      <th className="py-2 font-medium">Target Field (GADE)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {layer.attributes.map((attribute) => (
                      <tr key={attribute}>
                        <td className="py-2 pr-4">
                          <span className="font-mono text-xs text-slate-700">{attribute}</span>
                          {layer.sampleProperties?.[attribute] !== undefined && (
                            <span className="ml-2 text-xs text-slate-400">
                              = {String(layer.sampleProperties[attribute]).slice(0, 24)}
                            </span>
                          )}
                        </td>
                        <td className="py-2">
                          <select
                            value={mapping[attribute] ?? ''}
                            onChange={(event) =>
                              setMapping((prev) => {
                                const next = { ...prev }
                                if (event.target.value === '') delete next[attribute]
                                else next[attribute] = event.target.value as GadeField
                                return next
                              })
                            }
                            className="w-full max-w-xs rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          >
                            <option value="">— abaikan (skip) —</option>
                            {GADE_FIELDS.map((field) => (
                              <option key={field.key} value={field.key}>
                                {field.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Template mapping: muat / simpan / hapus */}
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">Template Mapping</p>
                {templateError && <p className="mt-1 text-xs text-red-600">{templateError}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={selectedTemplateId}
                    onChange={(event) => setSelectedTemplateId(event.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">— pilih template —</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.nama} ({Object.keys(template.mapping).length} field)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleLoadTemplate}
                    disabled={!selectedTemplateId}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Muat
                  </button>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    placeholder="Nama template baru…"
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveTemplate()}
                    disabled={isTemplateBusy || !templateName.trim()}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Simpan Mapping
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteTemplate()}
                    disabled={isTemplateBusy || !selectedTemplateId}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </>
          )}
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={fillLuasFromGeometry}
              onChange={(event) => setFillLuasFromGeometry(event.target.checked)}
              className="h-4 w-4 text-emerald-600"
            />
            Isi luas dari perhitungan geometry bila tidak dipetakan
          </label>
          <button
            type="button"
            onClick={() => setStep(5)}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Lanjut ke Preview
          </button>
        </div>
      )}

      {/* 5. PREVIEW + VALIDATE */}
      {layer && step >= 5 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">5. Preview & Validasi</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="sky">Total {validation.total}</Badge>
              <Badge tone="red">Invalid {validation.invalidCount}</Badge>
              <Badge tone="amber">Duplikat kode {validation.duplicateCodes.length}</Badge>
              <Badge tone="emerald">Luas total ≈ {formatLuas(validation.totalAreaM2)}</Badge>
              {layer.bbox && (
                <Badge tone="slate">
                  bbox [{layer.bbox.map((v) => v.toFixed(3)).join(', ')}]
                </Badge>
              )}
            </div>
            {validation.duplicateCodes.length > 0 && (
              <p className="mt-2 text-xs text-amber-700">
                Kode ganda (dalam file): {validation.duplicateCodes.join(', ')} — hanya kemunculan
                pertama yang diimport.
              </p>
            )}
            {validation.issues.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-xs text-red-600">
                {validation.issues.slice(0, 10).map((issue) => (
                  <li key={issue.index}>
                    Fitur #{issue.index + 1}: {issue.reason}
                  </li>
                ))}
                {validation.issues.length > 10 && (
                  <li>… dan {validation.issues.length - 10} lainnya.</li>
                )}
              </ul>
            )}
            <div className="mt-4">
              <MapView
                geojson={
                  { type: 'FeatureCollection', features: reprojectedFeatures } as never
                }
                className="h-96 w-full"
              />
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th className="py-2 pr-4 font-medium">#</th>
                    <th className="py-2 pr-4 font-medium">Kode</th>
                    <th className="py-2 pr-4 font-medium">No. Bidang</th>
                    <th className="py-2 pr-4 font-medium">Luas</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium">Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mappedParcels.slice(0, 20).map((parcel) => (
                    <tr key={parcel.index}>
                      <td className="py-2 pr-4 text-slate-400">{parcel.index + 1}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{parcel.kode}</td>
                      <td className="py-2 pr-4">{parcel.nomor_bidang ?? '—'}</td>
                      <td className="py-2 pr-4">{parcel.luas === null ? '—' : formatLuas(parcel.luas)}</td>
                      <td className="py-2 pr-4">{PARCEL_STATUS_LABELS[parcel.status]}</td>
                      <td className="py-2">
                        {!parcel.valid ? (
                          <Badge tone="red">Invalid</Badge>
                        ) : validation.duplicateCodes.includes(parcel.kode) ? (
                          <Badge tone="amber">Duplikat</Badge>
                        ) : (
                          <Badge tone="emerald">Siap</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {mappedParcels.length > 20 && (
                <p className="mt-2 text-xs text-slate-400">
                  Menampilkan 20 dari {mappedParcels.length} fitur.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setStep(6)}
              disabled={validation.total - validation.invalidCount === 0}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Lanjut ke Target & Import
            </button>
          </div>
        </div>
      )}

      {/* 6. TARGET + IMPORT */}
      {layer && step >= 6 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">6. Target & Import</h2>
          <div className="mt-3 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="target"
                checked={targetMode === 'PARCEL'}
                onChange={() => setTargetMode('PARCEL')}
                className="h-4 w-4 text-emerald-600"
              />
              Land Parcel (bidang tanah)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="target"
                checked={targetMode === 'PARENT'}
                onChange={() => setTargetMode('PARENT')}
                className="h-4 w-4 text-emerald-600"
              />
              Parent Area (batas lokasi)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="target"
                checked={targetMode === 'REFERENCE'}
                onChange={() => setTargetMode('REFERENCE')}
                className="h-4 w-4 text-emerald-600"
              />
              Reference Layer (§18)
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {targetMode === 'PARENT' &&
              'Polygon valid pertama akan disimpan sebagai batas induk lokasi terpilih; fitur lain dilewati.'}
            {targetMode === 'PARCEL' &&
              'Setiap polygon divalidasi server-side (geometry valid, inside parent, tanpa overlap, duplicate check) SEBELUM diinsert.'}
            {targetMode === 'REFERENCE' &&
              'Semua tipe geometry diterima (titik/garis/polygon) — tidak otomatis menjadi bidang (§18). Lokasi opsional.'}
          </p>

          {targetMode === 'REFERENCE' && (
            <div className="mt-4 max-w-md">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Jenis Layer Referensi<span className="text-red-500"> *</span>
              </label>
              <select
                value={referenceKind}
                onChange={(event) => setReferenceKind(event.target.value as ReferenceLayerKind)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {REFERENCE_LAYER_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {REFERENCE_LAYER_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-4 max-w-md">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {targetMode === 'PARENT'
                ? 'Lokasi yang akan diberi batas'
                : targetMode === 'PARCEL'
                  ? 'Lokasi induk bidang'
                  : 'Lokasi terkait (opsional)'}
              {targetMode !== 'REFERENCE' && <span className="text-red-500"> *</span>}
            </label>
            <select
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— Pilih lokasi —</option>
              {locationOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.kode} — {option.nama}
                </option>
              ))}
            </select>
          </div>

          {importError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {importError}
            </div>
          )}

          <button
            type="button"
            onClick={() => void runImport()}
            disabled={isImporting || (targetMode !== 'REFERENCE' && !locationId)}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isImporting ? 'Mengimpor…' : 'Mulai Import'}
          </button>

          {isImporting && (
            <p className="mt-2 text-xs text-slate-500">
              Memproses fitur satu per satu (validasi server per fitur)…
            </p>
          )}

          {counts && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800">Import selesai</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone="emerald">Imported {counts.imported}</Badge>
                <Badge tone="slate">Skipped {counts.skipped}</Badge>
                <Badge tone="red">Invalid {counts.invalid}</Badge>
                <Badge tone="amber">Duplicate {counts.duplicate}</Badge>
                <Badge tone="violet">Review Required {counts.reviewRequired.length}</Badge>
              </div>
              {counts.reviewRequired.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-700">
                    Butuh review — ditolak validasi server:
                  </p>
                  <ul className="mt-1 list-inside list-disc text-xs text-violet-700">
                    {counts.reviewRequired.slice(0, 10).map((item) => (
                      <li key={`${item.index}-${item.kode}`}>
                        Fitur #{item.index + 1} ({item.kode}): {item.reason}
                      </li>
                    ))}
                    {counts.reviewRequired.length > 10 && (
                      <li>… dan {counts.reviewRequired.length - 10} lainnya.</li>
                    )}
                  </ul>
                </div>
              )}
              {targetMode !== 'REFERENCE' && (
                <p className="mt-2 text-xs text-emerald-700">
                  <Link to="/bidang" className="font-medium underline">
                    Lihat daftar bidang tanah
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
