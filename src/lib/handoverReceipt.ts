import { ServiceError } from './errors'
import { formatDate, formatDateTime } from './format'
import { HANDOVER_TYPE_LABELS } from '../types/handover'
import type { HandoverRecord } from '../types/handover'

// Generator PDF "Berita Acara Serah Terima Arsip" (§14). jsPDF dimuat
// lazy (dynamic import) sehingga tidak membebani bundle utama.

type PdfDoc = import('jspdf').jsPDF

const MARGIN = 18
const PAGE_W = 210
const VALUE_X = MARGIN + 45
const VALUE_W = PAGE_W - MARGIN - VALUE_X

// Muat logo GADE sebagai HTMLImageElement untuk kop surat (gagal → kop tanpa logo).
async function loadLogoImage(): Promise<HTMLImageElement | null> {
  try {
    return await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image()
      img.onload = () => {
        console.info('[GadeSystem] Logo kop PDF dimuat.')
        resolve(img)
      }
      img.onerror = () => {
        console.warn('[GadeSystem] Logo kop PDF gagal dimuat.')
        resolve(null)
      }
      img.src = '/logo-gade.jpg'
    })
  } catch {
    return null
  }
}

function createDocument(
  record: HandoverRecord,
  jsPdf: PdfDoc,
  logoImage: HTMLImageElement | null,
): PdfDoc {
  const doc = jsPdf

  // Kopsurat: logo GADE kiri + identitas organisasi (§14).
  if (logoImage) {
    try {
      doc.addImage(logoImage, 'JPEG', MARGIN, 8, 22, 22)
    } catch (err) {
      console.warn('[GadeSystem] Gagal menempelkan logo ke kop:', err)
    }
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(21, 87, 36) // hijau GADE
  doc.text('GADE — DIVISI PERTANAHAN', PAGE_W / 2 + 8, 15, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('GARDA DEPAN PERTANAHAN', PAGE_W / 2 + 8, 21, { align: 'center' })
  doc.setTextColor(110)
  doc.setFontSize(8)
  doc.text('Sistem Informasi GadeSystem', PAGE_W / 2 + 8, 26, { align: 'center' })
  doc.setTextColor(0)
  doc.setDrawColor(21, 87, 36)
  doc.setLineWidth(0.6)
  doc.line(MARGIN, 31, PAGE_W - MARGIN, 31)
  doc.setLineWidth(0.2)

  // Judul dokumen
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('BERITA ACARA SERAH TERIMA ARSIP', PAGE_W / 2, 40, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Nomor: ${record.nomor}`, PAGE_W / 2, 46, { align: 'center' })
  doc.setDrawColor(150)
  doc.line(MARGIN, 51, PAGE_W - MARGIN, 51)

  let y = 60
  const row = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(`${label}:`, MARGIN, y)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(value.trim() || '—', VALUE_W) as string[]
    let yy = y
    for (const line of lines) {
      doc.text(line, VALUE_X, yy)
      yy += 5
    }
    y = yy + 3
  }

  const archive = record.archives
  row('Tanggal', formatDate(record.tanggal))
  row('Jenis', HANDOVER_TYPE_LABELS[record.jenis])
  row('Arsip', archive ? `${archive.kode} — ${archive.nama_dokumen}` : '—')
  const fisik = archive
    ? [archive.gudang, archive.rak, archive.box, archive.folder].filter(Boolean).join(' / ')
    : ''
  if (fisik) row('Lokasi Fisik', fisik)
  if (archive?.locations) {
    row('Terkait Lokasi', `${archive.locations.kode} — ${archive.locations.nama}`)
  }
  if (archive?.land_parcels) {
    const parcel = archive.land_parcels
    row('Terkait Bidang', parcel.nomor_bidang ? `${parcel.kode} (No. ${parcel.nomor_bidang})` : parcel.kode)
  }
  if (archive?.projects) {
    row('Terkait Project', `${archive.projects.kode} — ${archive.projects.nama}`)
  }
  row('Dari', record.dari)
  row('Kepada', record.kepada)
  row('Keperluan', record.keperluan ?? '')
  row('Catatan', record.catatan ?? '')

  // Area tanda tangan: dua kolom (Dari & Kepada)
  const sigY = Math.max(y + 12, 210)
  const signature = (x: number, role: string, name: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(`${role}:`, x, sigY)
    doc.setFont('helvetica', 'normal')
    doc.text(name, x, sigY + 5)
    doc.setDrawColor(0)
    doc.line(x, sigY + 45, x + 65, sigY + 45)
    doc.setFontSize(9)
    doc.setTextColor(110)
    doc.text('( Tanda Tangan )', x + 32.5, sigY + 50, { align: 'center' })
    doc.setTextColor(0)
  }
  signature(MARGIN, 'Dari', record.dari)
  signature(PAGE_W / 2 + 10, 'Kepada', record.kepada)

  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(
    `Dicetak ${formatDateTime(new Date().toISOString())} — GadeSystem`,
    PAGE_W / 2,
    288,
    { align: 'center' },
  )

  return doc
}

async function withDocument(record: HandoverRecord): Promise<PdfDoc> {
  const { jsPDF } = await import('jspdf')
  const logoImage = await loadLogoImage()
  return createDocument(record, new jsPDF({ unit: 'mm', format: 'a4' }), logoImage)
}

export async function downloadHandoverReceiptPdf(record: HandoverRecord): Promise<void> {
  const doc = await withDocument(record)
  doc.save(`Serah-Terima-${record.nomor}.pdf`)
}

export async function printHandoverReceiptPdf(record: HandoverRecord): Promise<void> {
  const doc = await withDocument(record)
  doc.autoPrint()
  const url = URL.createObjectURL(doc.output('blob'))
  const printWindow = window.open(url, '_blank')
  if (!printWindow) {
    URL.revokeObjectURL(url)
    throw new ServiceError('Popup diblokir browser. Izinkan popup lalu coba cetak lagi.')
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
