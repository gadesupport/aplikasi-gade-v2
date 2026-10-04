import { supabase } from '../lib/supabase'
import { toServiceError } from '../lib/errors'
import { requireSupabase } from './query'

// Statistik dashboard (§30) — satu RPC Postgres, satu call.

export interface DashboardStats {
  lokasi: {
    total: number
    survey: number
    pembahasan: number
    proses_pembebasan: number
    selesai: number
    ditolak: number
    ditunda: number
  }
  bidang: {
    total: number
    teridentifikasi: number
    survey: number
    legal_check: number
    negosiasi: number
    siap_transaksi: number
    transaksi: number
    selesai: number
    ditolak: number
    ditunda: number
  }
  pihak: { total: number }
  legalitas: {
    total: number
    ada: number
    belum_ada: number
    proses: number
    tidak_relevan: number
    perlu_verifikasi: number
  }
  luas: {
    target: number
    teridentifikasi: number
    deal: number
  }
  arsip: {
    total: number
    tersedia: number
    dipinjam: number
    hilang: number
    rusak: number
    diarsipkan: number
    dokumen_digital: number
  }
  gis: {
    lokasi_geometry: number
    bidang_geometry: number
    geometry_invalid: number
    overlap: number
    luas_parent_m2: number
    luas_terpetakan_m2: number
    coverage_percent: number | null
  }
}

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    requireSupabase()
    const { data, error } = await supabase.rpc('dashboard_stats')
    if (error) throw toServiceError(error)
    return data as DashboardStats
  },
}
