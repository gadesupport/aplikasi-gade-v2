import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 text-center">
      <p className="text-6xl font-bold text-slate-300">404</p>
      <h1 className="mt-4 text-xl font-semibold text-slate-900">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-sm text-slate-500">Halaman yang Anda cari tidak tersedia.</p>
      <Link
        to="/dashboard"
        className="mt-6 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        Kembali ke Dashboard
      </Link>
    </div>
  )
}
