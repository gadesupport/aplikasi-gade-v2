export interface CsvColumn {
  key: string
  label: string
}

// Generator CSV untuk Excel Indonesia: delimiter ';' + BOM UTF-8 agar
// kolom langsung terpisah saat dibuka tanpa import wizard.

// Guard formula injection: nilai teks yang diawali = + - @ atau TAB/CR
// diawali "'" agar tidak dieksekusi sebagai formula oleh Excel/LibreOffice.
// Angka negatif valid tetap dibiarkan.
const FORMULA_SAFE_NUMBER = /^-?\d+(\.\d+)?$/

function escapeCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[@=+\-]/.test(text) && !FORMULA_SAFE_NUMBER.test(text)) {
    text = `'` + text
  }
  if (/[";\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function toCsv(columns: CsvColumn[], rows: Record<string, unknown>[]): string {
  const header = columns.map((column) => escapeCell(column.label)).join(';')
  const body = rows.map((row) =>
    columns.map((column) => escapeCell(row[column.key])).join(';'),
  )
  // \r\n + BOM untuk kompatibilitas Excel Windows.
  return '\uFEFF' + [header, ...body].join('\r\n') + '\r\n'
}

export function downloadCsv(fileName: string, columns: CsvColumn[], rows: Record<string, unknown>[]): void {
  const blob = new Blob([toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
