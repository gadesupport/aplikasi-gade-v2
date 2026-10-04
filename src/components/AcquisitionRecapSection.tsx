import AcquisitionStatusBadge from './AcquisitionStatusBadge'
import { useAcquisitionRecap } from '../hooks/useAcquisitions'
import { formatLuas, formatRupiah } from '../lib/format'

function RecapCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  )
}

// Panel "Rekap Pembebasan" pada halaman detail lokasi — view
// acquisition_location_recap: jumlah per status, luas dibebaskan, dan
// totalan uang (non-BATAL).
export default function AcquisitionRecapSection({ locationId }: { locationId: string }) {
  const { recap, isLoading, error } = useAcquisitionRecap(locationId)

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">Rekap Pembebasan</h2>
      </div>

      {error ? (
        <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-3 p-10 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
          Memuat rekap pembebasan…
        </div>
      ) : !recap ? (
        <p className="p-6 text-sm text-slate-500">
          Belum ada proses pembebasan pada bidang-bidang lokasi ini.
        </p>
      ) : (
        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <AcquisitionStatusBadge status="NEGOSIASI" />
            <span className="text-sm font-semibold text-slate-900">{recap.negosiasi}</span>
            <AcquisitionStatusBadge status="SIAP_TRANSAKSI" />
            <span className="text-sm font-semibold text-slate-900">{recap.siap_transaksi}</span>
            <AcquisitionStatusBadge status="TRANSAKSI" />
            <span className="text-sm font-semibold text-slate-900">{recap.transaksi}</span>
            <AcquisitionStatusBadge status="SELESAI" />
            <span className="text-sm font-semibold text-slate-900">{recap.selesai}</span>
            <AcquisitionStatusBadge status="BATAL" />
            <span className="text-sm font-semibold text-slate-900">{recap.batal}</span>
          </div>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <RecapCell label="Bidang Dibebaskan" value={`${recap.bidang_dibebaskan}`} />
            <RecapCell label="Luas Dibebaskan" value={formatLuas(recap.luas_dibebaskan_m2)} />
            <RecapCell
              label="Total Kesepakatan"
              value={formatRupiah(recap.total_harga_kesepakatan)}
            />
            <RecapCell label="Total Uang Muka" value={formatRupiah(recap.total_uang_muka)} />
            <RecapCell label="Total Pelunasan" value={formatRupiah(recap.total_pelunasan)} />
          </dl>
          <p className="text-xs text-slate-400">
            Totalan uang & luas mengkecualikan catatan berstatus BATAL; hitungan status mencakup
            semua catatan.
          </p>
        </div>
      )}
    </div>
  )
}
