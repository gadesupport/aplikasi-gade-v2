import { useDashboardStats } from '../hooks/useDashboardStats'
import { formatLuas } from '../lib/format'

function StatCard({
  title,
  value,
  detail,
  tone = 'slate',
}: {
  title: string
  value: string
  detail?: string[]
  tone?: 'emerald' | 'red' | 'violet' | 'slate'
}) {
  const valueColor =
    tone === 'emerald'
      ? 'text-emerald-600'
      : tone === 'red'
        ? 'text-red-600'
        : tone === 'violet'
          ? 'text-violet-600'
          : 'text-slate-900'
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-500">{title}</h2>
      <p className={`mt-1 text-3xl font-bold ${valueColor}`}>{value}</p>
      {detail && detail.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
          {detail.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const { stats, isLoading, error } = useDashboardStats()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 p-16 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
        Memuat statistik…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!stats) return null

  const luasBelumDeal = Math.max(stats.luas.teridentifikasi - stats.luas.deal, 0)
  const coverage =
    stats.gis.coverage_percent === null ? '—' : `${stats.gis.coverage_percent}%`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Ringkasan data GadeSystem (§30).</p>
      </div>

      {/* Ringkasan utama */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Lokasi"
          value={String(stats.lokasi.total)}
          detail={[
            `Survey ${stats.lokasi.survey} · Pembahasan ${stats.lokasi.pembahasan}`,
            `Proses ${stats.lokasi.proses_pembebasan} · Selesai ${stats.lokasi.selesai}`,
            `Ditolak ${stats.lokasi.ditolak} · Ditunda ${stats.lokasi.ditunda}`,
          ]}
        />
        <StatCard
          title="Total Bidang"
          value={String(stats.bidang.total)}
          detail={[
            `Legal check ${stats.bidang.legal_check} · Negosiasi ${stats.bidang.negosiasi}`,
            `Siap transaksi ${stats.bidang.siap_transaksi} · Transaksi ${stats.bidang.transaksi}`,
            `Selesai ${stats.bidang.selesai} · Ditunda ${stats.bidang.ditunda}`,
          ]}
        />
        <StatCard title="Total Pihak/Pemilik" value={String(stats.pihak.total)} />
        <StatCard
          title="Legalitas"
          value={String(stats.legalitas.total)}
          detail={[
            `Ada ${stats.legalitas.ada} · Proses ${stats.legalitas.proses}`,
            `Perlu verifikasi ${stats.legalitas.perlu_verifikasi}`,
          ]}
        />
      </div>

      {/* Luas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Luas Target" value={formatLuas(stats.luas.target)} />
        <StatCard title="Luas Deal" value={formatLuas(stats.luas.deal)} tone="emerald" />
        <StatCard title="Luas Belum Deal" value={formatLuas(luasBelumDeal)} tone="red" />
      </div>

      {/* Arsip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Arsip"
          value={String(stats.arsip.total)}
          detail={[
            `Tersedia ${stats.arsip.tersedia}`,
            `Diarsipkan ${stats.arsip.diarsipkan}`,
            `Hilang ${stats.arsip.hilang} · Rusak ${stats.arsip.rusak}`,
          ]}
        />
        <StatCard
          title="Dokumen Dipinjam"
          value={String(stats.arsip.dipinjam)}
          tone={stats.arsip.dipinjam > 0 ? 'red' : 'slate'}
          detail={[`Dokumen digital: ${stats.arsip.dokumen_digital}`]}
        />
        <StatCard
          title="Geometry Invalid"
          value={String(stats.gis.geometry_invalid)}
          tone={stats.gis.geometry_invalid > 0 ? 'violet' : 'slate'}
          detail={[
            `Lokasi bergeometry ${stats.gis.lokasi_geometry}`,
            `Bidang bergeometry ${stats.gis.bidang_geometry}`,
          ]}
        />
        <StatCard
          title="Overlap"
          value={String(stats.gis.overlap)}
          tone={stats.gis.overlap > 0 ? 'red' : 'slate'}
        />
      </div>

      {/* Coverage */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-slate-500">Coverage Pemetaan</h2>
          <span className="text-2xl font-bold text-emerald-600">{coverage}</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${Math.min(stats.gis.coverage_percent ?? 0, 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Luas terpetakan {formatLuas(stats.gis.luas_terpetakan_m2)} dari parent{' '}
          {formatLuas(stats.gis.luas_parent_m2)}.
        </p>
      </div>
    </div>
  )
}
