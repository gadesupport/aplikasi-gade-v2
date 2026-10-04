import { supabase } from '../lib/supabase'
import { requireSupabase, unwrapQuery } from './query'

// Laporan (AGENTS.md modul Laporan) — data tabular per jenis dengan filter;
// hasil dipakai untuk tabel UI dan export CSV.

export type ReportKey =
  | 'LOKASI'
  | 'BIDANG'
  | 'PIHAK'
  | 'LEGALITAS'
  | 'PEMBEBASAN'
  | 'ARSIP'
  | 'GIS'

export interface ReportColumn {
  key: string
  label: string
}

export interface ReportData {
  columns: ReportColumn[]
  rows: Record<string, string | number | null>[]
}

export interface ReportFilters {
  lokasiId?: string
  status?: string
}

const LIMIT = 5000

function pick<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

async function fetchLocations(): Promise<Map<string, { kode: string; nama: string }>> {
  const rows =
    (await unwrapQuery<{ id: string; kode: string; nama: string }[]>(
      supabase.from('locations').select('id, kode, nama').limit(LIMIT),
    )) ?? []
  return new Map(rows.map((row) => [row.id, { kode: row.kode, nama: row.nama }]))
}

export const reportService = {
  async fetchReport(key: ReportKey, filters: ReportFilters): Promise<ReportData> {
    requireSupabase()
    switch (key) {
      case 'LOKASI': {
        const columns: ReportColumn[] = [
          { key: 'kode', label: 'Kode' },
          { key: 'nama', label: 'Nama' },
          { key: 'wilayah', label: 'Desa/Kec/Kab' },
          { key: 'luas_target', label: 'Luas Target (m²)' },
          { key: 'luas_teridentifikasi', label: 'Luas Teridentifikasi (m²)' },
          { key: 'luas_deal', label: 'Luas Deal (m²)' },
          { key: 'luas_terpetakan', label: 'Luas Terpetakan (m²)' },
          { key: 'coverage', label: 'Coverage (%)' },
          { key: 'status', label: 'Status' },
        ]
        let query = supabase
          .from('locations')
          .select('id, kode, nama, desa, kecamatan, kabupaten, luas_target, luas_teridentifikasi, luas_deal, status')
          .order('kode')
          .limit(LIMIT)
        if (filters.lokasiId) query = query.eq('id', filters.lokasiId)
        if (filters.status) query = query.eq('status', filters.status)
        const rows = (await unwrapQuery<Record<string, unknown>[]>(query)) ?? []
        const statsRows =
          (await unwrapQuery<{ location_id: string; luas_bidang_netto_m2: number; coverage_percent: number | null }[]>(
            supabase.from('location_area_stats').select('location_id, luas_bidang_netto_m2, coverage_percent').limit(LIMIT),
          )) ?? []
        const statsById = new Map(statsRows.map((row) => [row.location_id, row]))
        return {
          columns,
          rows: rows.map((row) => {
            const stats = statsById.get(String(row['id']))
            return {
              kode: row['kode'] as string,
              nama: row['nama'] as string,
              wilayah: [row['desa'], row['kecamatan'], row['kabupaten']].filter(Boolean).join(' / '),
              luas_target: row['luas_target'] as number | null,
              luas_teridentifikasi: row['luas_teridentifikasi'] as number | null,
              luas_deal: row['luas_deal'] as number | null,
              luas_terpetakan: stats?.luas_bidang_netto_m2 ?? null,
              coverage: stats?.coverage_percent ?? null,
              status: row['status'] as string,
            }
          }),
        }
      }

      case 'BIDANG': {
        const columns: ReportColumn[] = [
          { key: 'kode', label: 'Kode' },
          { key: 'nomor_bidang', label: 'No. Bidang' },
          { key: 'lokasi', label: 'Lokasi' },
          { key: 'jenis_hak', label: 'Jenis Hak' },
          { key: 'nomor_hak', label: 'No. Hak' },
          { key: 'luas', label: 'Luas (m²)' },
          { key: 'status', label: 'Status' },
          { key: 'harga_kesepakatan', label: 'Harga Kesepakatan' },
        ]
        let query = supabase
          .from('land_parcels')
          .select('kode, nomor_bidang, jenis_hak, nomor_hak, luas, status_pembebasan, harga_kesepakatan, lokasi:locations(kode, nama)')
          .order('kode')
          .limit(LIMIT)
        if (filters.lokasiId) query = query.eq('lokasi_id', filters.lokasiId)
        if (filters.status) query = query.eq('status_pembebasan', filters.status)
        const rows = (await unwrapQuery<Record<string, unknown>[]>(query)) ?? []
        return {
          columns,
          rows: rows.map((row) => {
            const lokasi = pick(row['lokasi'] as { kode: string; nama: string } | null)
            return {
              kode: row['kode'] as string,
              nomor_bidang: (row['nomor_bidang'] as string | null) ?? null,
              lokasi: lokasi ? `${lokasi.kode} — ${lokasi.nama}` : null,
              jenis_hak: (row['jenis_hak'] as string | null) ?? null,
              nomor_hak: (row['nomor_hak'] as string | null) ?? null,
              luas: row['luas'] as number | null,
              status: row['status_pembebasan'] as string,
              harga_kesepakatan: row['harga_kesepakatan'] as number | null,
            }
          }),
        }
      }

      case 'PIHAK': {
        const columns: ReportColumn[] = [
          { key: 'nama', label: 'Nama' },
          { key: 'nik', label: 'NIK' },
          { key: 'tipe', label: 'Tipe' },
          { key: 'telepon', label: 'Telepon' },
          { key: 'alamat', label: 'Alamat' },
          { key: 'jumlah_bidang', label: 'Jumlah Bidang' },
        ]
        let query = supabase
          .from('parties')
          .select('nama, nik, tipe_pihak, nomor_telepon, alamat, relasi:parcel_parties(count)')
          .order('nama')
          .limit(LIMIT)
        if (filters.status) query = query.eq('tipe_pihak', filters.status)
        const rows = (await unwrapQuery<Record<string, unknown>[]>(query)) ?? []
        return {
          columns,
          rows: rows.map((row) => {
            const relasi = row['relasi'] as { count: number }[] | null
            return {
              nama: row['nama'] as string,
              nik: (row['nik'] as string | null) ?? null,
              tipe: row['tipe_pihak'] as string,
              telepon: (row['nomor_telepon'] as string | null) ?? null,
              alamat: (row['alamat'] as string | null) ?? null,
              jumlah_bidang: relasi?.[0]?.count ?? 0,
            }
          }),
        }
      }

      case 'LEGALITAS': {
        const columns: ReportColumn[] = [
          { key: 'bidang', label: 'Bidang' },
          { key: 'jenis', label: 'Jenis Dokumen' },
          { key: 'nomor', label: 'Nomor' },
          { key: 'tanggal', label: 'Tanggal' },
          { key: 'penerbit', label: 'Penerbit' },
          { key: 'pihak', label: 'Pihak Terkait' },
          { key: 'status', label: 'Status' },
        ]
        let query = supabase
          .from('legalities')
          .select('jenis_dokumen, nomor_dokumen, tanggal_dokumen, penerbit, status, bidang:land_parcels(kode, nomor_bidang, lokasi:locations(kode, nama)), pihak:parties(nama)')
          .order('jenis_dokumen')
          .limit(LIMIT)
        if (filters.lokasiId) {
          const parcelIds =
            (await unwrapQuery<{ id: string }[]>(
              supabase.from('land_parcels').select('id').eq('lokasi_id', filters.lokasiId).limit(LIMIT),
            )) ?? []
          query = parcelIds.length > 0
            ? query.in('bidang_id', parcelIds.map((row) => row.id))
            : query.eq('bidang_id', '00000000-0000-0000-0000-000000000000')
        }
        if (filters.status) query = query.eq('status', filters.status)
        const rows = (await unwrapQuery<Record<string, unknown>[]>(query)) ?? []
        return {
          columns,
          rows: rows.map((row) => {
            const bidang = pick(row['bidang'] as { kode: string; nomor_bidang: string | null; lokasi: unknown } | null)
            const lokasi = bidang ? pick(bidang.lokasi as { kode: string; nama: string } | null) : null
            const pihak = pick(row['pihak'] as { nama: string } | null)
            return {
              bidang: bidang ? `${bidang.kode}${bidang.nomor_bidang ? ` (No. ${bidang.nomor_bidang})` : ''}${lokasi ? ` — ${lokasi.nama}` : ''}` : null,
              jenis: row['jenis_dokumen'] as string,
              nomor: (row['nomor_dokumen'] as string | null) ?? null,
              tanggal: (row['tanggal_dokumen'] as string | null) ?? null,
              penerbit: (row['penerbit'] as string | null) ?? null,
              pihak: pihak?.nama ?? null,
              status: row['status'] as string,
            }
          }),
        }
      }

      case 'PEMBEBASAN': {
        const columns: ReportColumn[] = [
          { key: 'bidang', label: 'Bidang' },
          { key: 'lokasi', label: 'Lokasi' },
          { key: 'tanggal_mulai', label: 'Tgl Mulai' },
          { key: 'status', label: 'Status' },
          { key: 'harga_penawaran', label: 'Penawaran' },
          { key: 'harga_kesepakatan', label: 'Kesepakatan' },
          { key: 'uang_muka', label: 'Uang Muka' },
          { key: 'pelunasan', label: 'Pelunasan' },
          { key: 'pihak_terlibat', label: 'Pihak Terlibat' },
        ]
        let query = supabase
          .from('acquisitions')
          .select('tanggal_mulai, harga_penawaran, harga_kesepakatan, uang_muka, pelunasan, pihak_terlibat, status_transaksi, bidang:land_parcels(kode, nomor_bidang, lokasi:locations(kode, nama))')
          .order('tanggal_mulai', { ascending: false })
          .limit(LIMIT)
        if (filters.lokasiId) query = query.eq('land_parcels.lokasi_id', filters.lokasiId)
        if (filters.status) query = query.eq('status_transaksi', filters.status)
        const rows = (await unwrapQuery<Record<string, unknown>[]>(query)) ?? []
        return {
          columns,
          rows: rows.map((row) => {
            const bidang = pick(row['bidang'] as { kode: string; nomor_bidang: string | null; lokasi: unknown } | null)
            const lokasi = bidang ? pick(bidang.lokasi as { kode: string; nama: string } | null) : null
            return {
              bidang: bidang ? bidang.kode : null,
              lokasi: lokasi ? `${lokasi.kode} — ${lokasi.nama}` : null,
              tanggal_mulai: row['tanggal_mulai'] as string,
              status: row['status_transaksi'] as string,
              harga_penawaran: row['harga_penawaran'] as number | null,
              harga_kesepakatan: row['harga_kesepakatan'] as number | null,
              uang_muka: row['uang_muka'] as number | null,
              pelunasan: row['pelunasan'] as number | null,
              pihak_terlibat: (row['pihak_terlibat'] as string | null) ?? null,
            }
          }),
        }
      }

      case 'ARSIP': {
        const columns: ReportColumn[] = [
          { key: 'kode', label: 'Kode' },
          { key: 'nama', label: 'Nama Dokumen' },
          { key: 'tipe', label: 'Tipe Relasi' },
          { key: 'target', label: 'Terkait' },
          { key: 'lokasi_fisik', label: 'Lokasi Fisik' },
          { key: 'status', label: 'Status' },
        ]
        let query = supabase
          .from('archives')
          .select('kode, nama_dokumen, tipe_relasi, gudang, rak, box, folder, status, locations(kode, nama), land_parcels(kode), projects(kode, nama)')
          .order('kode')
          .limit(LIMIT)
        if (filters.lokasiId) query = query.eq('location_id', filters.lokasiId)
        if (filters.status) query = query.eq('status', filters.status)
        const rows = (await unwrapQuery<Record<string, unknown>[]>(query)) ?? []
        return {
          columns,
          rows: rows.map((row) => {
            const lokasi = pick(row['locations'] as { kode: string; nama: string } | null)
            const parcel = pick(row['land_parcels'] as { kode: string } | null)
            const project = pick(row['projects'] as { kode: string; nama: string } | null)
            const target = lokasi
              ? `${lokasi.kode} — ${lokasi.nama}`
              : parcel
                ? parcel.kode
                : project
                  ? `${project.kode} — ${project.nama}`
                  : 'Umum'
            return {
              kode: row['kode'] as string,
              nama: row['nama_dokumen'] as string,
              tipe: row['tipe_relasi'] as string,
              target,
              lokasi_fisik: [row['gudang'], row['rak'], row['box'], row['folder']].filter(Boolean).join(' / ') || null,
              status: row['status'] as string,
            }
          }),
        }
      }

      case 'GIS': {
        const columns: ReportColumn[] = [
          { key: 'lokasi', label: 'Lokasi' },
          { key: 'luas_parent', label: 'Luas Parent (m²)' },
          { key: 'luas_bidang', label: 'Luas Bidang Netto (m²)' },
          { key: 'sisa', label: 'Sisa (m²)' },
          { key: 'coverage', label: 'Coverage (%)' },
          { key: 'terpetakan', label: 'Bidang Terpetakan' },
          { key: 'status', label: 'Status Pemetaan' },
        ]
        const statsRows =
          (await unwrapQuery<Record<string, unknown>[]>(
            supabase.from('location_area_stats').select('*').order('location_id').limit(LIMIT),
          )) ?? []
        const locations = await fetchLocations()
        return {
          columns,
          rows: statsRows.map((row) => {
            const lokasi = locations.get(row['location_id'] as string)
            return {
              lokasi: lokasi ? `${lokasi.kode} — ${lokasi.nama}` : null,
              luas_parent: row['luas_parent_m2'] as number | null,
              luas_bidang: row['luas_bidang_netto_m2'] as number | null,
              sisa: row['sisa_luas_m2'] as number | null,
              coverage: row['coverage_percent'] as number | null,
              terpetakan: `${row['bidang_terpetakan']} / ${row['bidang_total']}`,
              status: row['status_pemetaan'] as string,
            }
          }),
        }
      }
    }
  },
}
