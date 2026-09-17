interface StatCardProps {
  title: string
  description: string
}

function StatCard({ title, description }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-500">{title}</h2>
      <p className="mt-2 text-3xl font-semibold text-slate-300">—</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{description}</p>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ringkasan data lokasi, bidang tanah, pihak, arsip, dan GIS.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Placeholder — modul bisnis belum dibuat. Kartu di bawah akan diisi oleh dashboardService
        setelah backend Supabase tersambung.
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Lokasi"
          description="Total lokasi per status: survey, pembahasan, proses pembebasan, selesai, ditolak, ditunda."
        />
        <StatCard
          title="Bidang Tanah"
          description="Total bidang per status: legal check, negosiasi, siap transaksi, transaksi, selesai."
        />
        <StatCard
          title="Luas"
          description="Luas target, teridentifikasi, deal, dan belum deal (m²)."
        />
        <StatCard title="Pihak" description="Total pihak/pemilik terdaftar." />
        <StatCard
          title="Arsip"
          description="Total arsip per tipe relasi (lokasi, bidang, project, umum) dan status pinjaman."
        />
        <StatCard
          title="GIS"
          description="Coverage geometry, geometry invalid, overlap, dan area belum terpetakan."
        />
      </div>
    </div>
  )
}
