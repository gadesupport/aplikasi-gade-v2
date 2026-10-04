import type { MenuItem } from '../types/menu'

// Grup side menu (§29) — kelompok item agar navigasi rapi.
export type MenuGroup = 'Utama' | 'Data Master' | 'Operasional' | 'GIS' | 'Laporan & Audit' | 'Sistem'

export interface GroupedMenuItem extends MenuItem {
  group: MenuGroup
}

export const MENU_ITEMS: GroupedMenuItem[] = [
  { path: '/dashboard', label: 'Dashboard', description: 'Ringkasan data lokasi, bidang tanah, pihak, arsip, dan GIS.', group: 'Utama' },
  { path: '/lokasi', label: 'Lokasi', description: 'Kelola lokasi/areal yang sedang dianalisis atau dibebaskan.', group: 'Data Master' },
  { path: '/bidang', label: 'Bidang Tanah', description: 'Kelola bidang tanah individual di dalam setiap lokasi.', group: 'Data Master' },
  { path: '/pihak', label: 'Pihak/Pemilik', description: 'Kelola data pihak/pemilik dan relasinya dengan bidang.', group: 'Data Master' },
  { path: '/project', label: 'Project', description: 'Kelola project, izin, dan dokumen project.', group: 'Data Master' },
  { path: '/survey', label: 'Survey', description: 'Catat hasil survey pada lokasi dan bidang.', group: 'Operasional' },
  { path: '/pembahasan', label: 'Pembahasan', description: 'Pembahasan dan keputusan layak/perlu kajian/tidak layak.', group: 'Operasional' },
  { path: '/legalitas', label: 'Legalitas', description: 'Kelola dokumen legalitas pada level bidang.', group: 'Operasional' },
  { path: '/pembebasan', label: 'Pembebasan', description: 'Kelola proses negosiasi dan transaksi pembebasan bidang.', group: 'Operasional' },
  { path: '/arsip', label: 'Arsip', description: 'Kelola arsip fisik beserta lokasi penyimpanannya.', group: 'Operasional' },
  { path: '/serah-terima', label: 'Serah Terima', description: 'Catat berkas masuk, keluar, dan kembali.', group: 'Operasional' },
  { path: '/peta', label: 'Peta', description: 'Peta GIS lokasi dan bidang dengan editing polygon.', group: 'GIS' },
  { path: '/laporan', label: 'Laporan', description: 'Laporan monitoring dan progres pembebasan.', group: 'Laporan & Audit' },
  { path: '/audit-log', label: 'Audit Log', description: 'Jejak audit aktivitas pengguna.', group: 'Laporan & Audit' },
  { path: '/pengaturan', label: 'Pengaturan', description: 'Pengaturan aplikasi dan pengguna.', group: 'Sistem' },
]

// Urutan grup untuk render sidebar.
export const MENU_GROUP_ORDER: MenuGroup[] = [
  'Utama',
  'Data Master',
  'Operasional',
  'GIS',
  'Laporan & Audit',
  'Sistem',
]
