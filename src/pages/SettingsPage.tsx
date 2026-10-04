import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Badge from '../components/Badge'
import { useAuth } from '../hooks/useAuth'
import { profileService } from '../services/profileService'
import { healthService } from '../services/healthService'
import type { ConnectionStatus } from '../services/healthService'
import { permissionService, defaultPermission } from '../services/permissionService'
import { permissionKey } from '../hooks/usePermissions'
import type { RolePermissionRow, PermissionAction } from '../services/permissionService'
import { usePermissions } from '../hooks/usePermissions'
import { MENU_ITEMS } from '../lib/menu'
import type { UserRole } from '../types/auth'

const ROLE_LABELS: Record<UserRole, string> = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
  SURVEYOR: 'Surveyor',
  LEGAL: 'Legal',
}

const ROLE_TONES: Record<UserRole, 'red' | 'indigo' | 'sky' | 'teal'> = {
  SUPERADMIN: 'red',
  ADMIN: 'indigo',
  SURVEYOR: 'sky',
  LEGAL: 'teal',
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth()
  const [profiles, setProfiles] = useState<
    { id: string; nama: string; role: UserRole; created_at: string }[]
  >([])
  const [profilesLoading, setProfilesLoading] = useState(false)
  const [profilesLoaded, setProfilesLoaded] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [nama, setNama] = useState(user?.nama ?? '')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [namaError, setNamaError] = useState<string | null>(null)

  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [roleError, setRoleError] = useState<string | null>(null)

  const [connection, setConnection] = useState<ConnectionStatus | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const isSuperadmin = user?.role === 'SUPERADMIN'

  // Matriks akses role × menu (superadmin).
  const { rows: permissionRows, reload: reloadPermissions } = usePermissions()
  const [matrix, setMatrix] = useState<Record<string, RolePermissionRow>>({})
  const [isSavingMatrix, setIsSavingMatrix] = useState(false)
  const [matrixSaved, setMatrixSaved] = useState(false)
  const [matrixError, setMatrixError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSuperadmin) return
    // Prefill dengan default (selaras seed migration) lalu timpa dengan
    // baris database bila ada — matriks tetap tampil wajar sebelum
    // migration 000022 dijalankan.
    const next: Record<string, RolePermissionRow> = {}
    for (const item of MENU_ITEMS) {
      for (const role of Object.keys(ROLE_LABELS) as UserRole[]) {
        next[permissionKey(role, item.path)] = {
          role,
          menu_path: item.path,
          can_view: defaultPermission(role, item.path, 'view'),
          can_create: defaultPermission(role, item.path, 'create'),
          can_update: defaultPermission(role, item.path, 'update'),
          can_delete: defaultPermission(role, item.path, 'delete'),
        }
      }
    }
    for (const row of permissionRows) {
      next[permissionKey(row.role, row.menu_path)] = row
    }
    setMatrix(next)
  }, [permissionRows, isSuperadmin])


  function loadProfiles() {
    if (!isSuperadmin) return
    setProfilesLoading(true)
    setProfileError(null)
    profileService
      .listProfiles()
      .then((rows) => {
        setProfiles(rows.map((row) => ({ ...row, role: row.role as UserRole })))
        setProfilesLoaded(true)
      })
      .catch((err) => setProfileError(err instanceof Error ? err.message : 'Gagal memuat pengguna.'))
      .finally(() => setProfilesLoading(false))
  }

  useEffect(() => {
    loadProfiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperadmin])

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSavingProfile(true)
    setNamaError(null)
    setProfileSaved(false)
    try {
      const updated = await profileService.updateMyProfile(nama)
      setNama(updated.nama)
      setProfileSaved(true)
      // Muat ulang profil di AuthContext agar header ikut terbarui.
      refreshUser()
    } catch (err) {
      setNamaError(err instanceof Error ? err.message : 'Gagal menyimpan profil.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handleRoleChange(id: string, role: UserRole) {
    setBusyUserId(id)
    setRoleError(null)
    try {
      const updated = await profileService.updateRole(id, role)
      setProfiles((prev) => prev.map((row) => (row.id === id ? { ...row, role: updated.role as UserRole } : row)))
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : 'Gagal mengubah role.')
    } finally {
      setBusyUserId(null)
    }
  }

  async function handleCheckConnection() {
    setIsChecking(true)
    const status = await healthService.checkConnection()
    setConnection(status)
    setIsChecking(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pengaturan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Profil, manajemen pengguna, dan informasi sistem.
        </p>
      </div>

      {/* Profil saya */}
      <Card title="Profil Saya">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nama</label>
            <input
              type="text"
              value={nama}
              onChange={(event) => setNama(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="text"
              disabled
              value={user?.email ?? ''}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
            />
            <p className="mt-1 text-xs text-slate-400">Email dikelola Supabase Auth — tidak dapat diubah di sini.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Role:</span>
            {user && <Badge tone={ROLE_TONES[user.role]}>{ROLE_LABELS[user.role]}</Badge>}
          </div>
          {namaError && <p className="text-sm text-red-600">{namaError}</p>}
          {profileSaved && <p className="text-sm text-emerald-600">Profil tersimpan.</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingProfile ? 'Menyimpan…' : 'Simpan Profil'}
            </button>
          </div>
        </form>
      </Card>

      {/* Manajemen pengguna — SUPERADMIN */}
      <Card title="Manajemen Pengguna">
        {!isSuperadmin ? (
          <p className="text-sm text-slate-500">
            Hanya SUPERADMIN yang dapat mengelola role pengguna.
          </p>
        ) : (
          <>
            {profileError && <p className="text-sm text-red-600">{profileError}</p>}
            {roleError && <p className="mb-2 text-sm text-red-600">{roleError}</p>}
            {profilesLoading ? (
              <p className="text-sm text-slate-500">Memuat pengguna…</p>
            ) : !profilesLoaded ? null : (
              <ul className="divide-y divide-slate-100">
                {profiles.map((profile) => (
                  <li key={profile.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {profile.nama}
                        {profile.id === user?.id && (
                          <span className="ml-2 text-xs text-slate-400">(Anda)</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">Dibuat {profile.created_at.slice(0, 10)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={profile.role}
                        onChange={(event) => void handleRoleChange(profile.id, event.target.value as UserRole)}
                        disabled={busyUserId === profile.id || profile.id === user?.id}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                      >
                        {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                      {busyUserId === profile.id && (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-400">
              User baru dibuat via Supabase Dashboard → Authentication → Users (trigger otomatis
              membuat profilnya). Role sendiri tidak dapat diubah.
            </p>
          </>
        )}
      </Card>

      {/* Matriks akses role × menu (superadmin) */}
      {isSuperadmin && (
        <Card title="Akses Role per Menu (Menu & CRUD)">
          {matrixError && <p className="mb-2 text-sm text-red-600">{matrixError}</p>}
          {matrixSaved && <p className="mb-2 text-sm text-emerald-600">Matriks akses tersimpan.</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4 font-medium">Menu</th>
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                    <th key={role} className="px-2 py-2 font-medium">{ROLE_LABELS[role]}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {MENU_ITEMS.map((item) => (
                  <tr key={item.path}>
                    <td className="py-2 pr-4 font-medium text-slate-700">{item.label}</td>
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => {
                      const key = `${role}|${item.path}`
                      const cell =
                        matrix[key] ??
                        {
                          role,
                          menu_path: item.path,
                          can_view: false,
                          can_create: false,
                          can_update: false,
                          can_delete: false,
                        }
                      const actions: { key: PermissionAction; label: string }[] = [
                        { key: 'view', label: 'L' },
                        { key: 'create', label: 'C' },
                        { key: 'update', label: 'U' },
                        { key: 'delete', label: 'D' },
                      ]
                      return (
                        <td key={role} className="px-2 py-2">
                          <div className="flex gap-1.5">
                            {actions.map((action) => {
                              const permKey = ('can_' + action.key) as keyof RolePermissionRow
                              return (
                              <label
                                key={action.key}
                                className="flex cursor-pointer items-center gap-0.5 text-[10px] text-slate-500"
                                title={action.label}
                              >
                                <input
                                  type="checkbox"
                                  checked={Boolean(cell[permKey])}
                                  onChange={(event) =>
                                    setMatrix((prev) => ({
                                      ...prev,
                                      [key]: {
                                        ...cell,
                                        [permKey]: event.target.checked,
                                      } as RolePermissionRow,
                                    }))
                                  }
                                  className="h-3 w-3 text-emerald-600"
                                />
                                {action.label}
                              </label>
                              )
                            })}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            L = lihat menu, C = tambah, U = ubah, D = hapus. SUPERADMIN selalu memiliki akses
            penuh. Pengaman terakhir tetap RLS di database.
          </p>
          <button
            type="button"
            onClick={() => {
              setIsSavingMatrix(true)
              setMatrixError(null)
              setMatrixSaved(false)
              permissionService
                .saveBulk(Object.values(matrix))
                .then(() => {
                  setMatrixSaved(true)
                  reloadPermissions()
                })
                .catch((err) =>
                  setMatrixError(err instanceof Error ? err.message : 'Gagal menyimpan matriks.'),
                )
                .finally(() => setIsSavingMatrix(false))
            }}
            disabled={isSavingMatrix}
            className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingMatrix ? 'Menyimpan…' : 'Simpan Matriks Akses'}
          </button>
        </Card>
      )}

      {/* Info sistem */}
      <Card title="Info Sistem">
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">
            Versi aplikasi: <span className="font-semibold text-slate-900">0.1.0</span>
          </p>
          <p className="text-slate-600">
            Database: <span className="font-semibold text-slate-900">Supabase (PostgreSQL + PostGIS)</span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleCheckConnection()}
              disabled={isChecking}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isChecking ? 'Memeriksa…' : 'Cek Koneksi Database'}
            </button>
            {connection && (
              <span className={connection.ok ? 'text-sm text-emerald-600' : 'text-sm text-red-600'}>
                {connection.message}
                {connection.latencyMs !== null ? ` (${connection.latencyMs} ms)` : ''}
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
