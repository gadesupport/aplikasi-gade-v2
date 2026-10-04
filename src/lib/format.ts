const numberFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const dateFormatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' })

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : numberFormatter.format(value)
}

export function formatLuas(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${numberFormatter.format(value)} m²`
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

export function formatRupiah(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : rupiahFormatter.format(value)
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return '—'
  if (meters < 1000) return `${numberFormatter.format(Math.round(meters))} m`
  return `${numberFormatter.format(Math.round(meters / 100) / 10)} km`
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${numberFormatter.format(Math.round(bytes / 1024))} KB`
  return `${numberFormatter.format(Math.round(bytes / (1024 * 1024) * 10) / 10)} MB`
}
