import type { MenuItem } from '../types/menu'

// Urutan menu mengikuti AGENTS.md bagian 29 (UI/UX).
export const MENU_ITEMS: MenuItem[] = [
  { path: '/dashboard', label: 'Dashboard', description: 'Ringkasan data lokasi, bidang tanah, pihak, arsip, dan GIS.' },
  { path: '/lokasi', label: 'Lokasi', description: 'Kelola lokasi/areal yang sedang dianalisis atau dibebaskan.' },
  { path: '/bidang', label: 'Bidang Tanah', description: 'Kelola bidang tanah individual di dalam setiap lokasi.' },
  { path: '/pihak', label: 'Pihak/Pemilik', description: 'Kelola data pihak/pemilik dan relasinya dengan bidang.' },
  { path: '/survey', label: 'Survey', description: 'Catat hasil survey pada lokasi dan bidang.' },
  { path: '/pembahasan', label: 'Pembahasan', description: 'Catat pembahasan dan keputusan layak/perlu kajian/tidak layak.' },
  { path: '/legalitas', label: 'Legalitas', description: 'Kelola dokumen legalitas pada level bidang.' },
  { path: '/pembebasan', label: 'Pembebasan', description: 'Kelola proses negosiasi dan transaksi pembebasan bidang.' },
  { path: '/project', label: 'Project', description: 'Kelola project, izin, dan dokumen project.' },
  { path: '/arsip', label: 'Arsip', description: 'Kelola arsip fisik beserta lokasi penyimpanannya.' },
  { path: '/peta', label: 'Peta', description: 'Peta GIS lokasi dan bidang dengan editing polygon.' },
  { path: '/serah-terima', label: 'Serah Terima', description: 'Catat berkas masuk, keluar, dan kembali.' },
  { path: '/laporan', label: 'Laporan', description: 'Laporan monitoring dan progres pembebasan.' },
  { path: '/audit-log', label: 'Audit Log', description: 'Jejak audit aktivitas pengguna.' },
  { path: '/pengaturan', label: 'Pengaturan', description: 'Pengaturan aplikasi dan pengguna.' },
]
