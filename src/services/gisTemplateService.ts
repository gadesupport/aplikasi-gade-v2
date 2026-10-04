import { isServiceError, ServiceError, toServiceError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { requireSupabase, unwrapQuery } from './query'
import type { GadeField } from './gisImportService'

// Template field mapping import GIS (§24) — disimpan di tabel
// gis_field_templates, dipakai bersama tim (created_by tercatat).

export interface MappingTemplate {
  id: string
  nama: string
  mapping: Record<string, GadeField>
  created_by: string | null
  created_at: string
  updated_at: string
}

function parseMapping(raw: unknown): Record<string, GadeField> {
  if (typeof raw !== 'object' || raw === null) return {}
  const result: Record<string, GadeField> = {}
  const allowed: GadeField[] = [
    'kode',
    'nomor_bidang',
    'luas',
    'jenis_hak',
    'nomor_hak',
    'status',
    'nama_pihak',
  ]
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && allowed.includes(value as GadeField)) {
      result[key] = value as GadeField
    }
  }
  return result
}

export const gisTemplateService = {
  async list(): Promise<MappingTemplate[]> {
    requireSupabase()
    const rows =
      (await unwrapQuery<MappingTemplate[]>(
        supabase.from('gis_field_templates').select('*').order('nama', { ascending: true }),
      )) ?? []
    return rows.map((row) => ({ ...row, mapping: parseMapping(row.mapping) }))
  },

  async save(nama: string, mapping: Record<string, GadeField>): Promise<MappingTemplate> {
    requireSupabase()
    const trimmed = nama.trim()
    if (!trimmed) {
      throw new ServiceError('Nama template wajib diisi.')
    }
    if (Object.keys(mapping).length === 0) {
      throw new ServiceError('Mapping masih kosong — tidak ada yang bisa disimpan.')
    }
    try {
      const row = await unwrapQuery<MappingTemplate>(
        supabase
          .from('gis_field_templates')
          .upsert(
            { nama: trimmed, mapping },
            { onConflict: 'nama' },
          )
          .select('*')
          .single(),
      )
      if (!row) throw new ServiceError('Gagal menyimpan template.')
      return { ...row, mapping: parseMapping(row.mapping) }
    } catch (error) {
      if (isServiceError(error) && error.code === '23505') {
        throw new ServiceError('Nama template sudah digunakan.', {
          code: 'TEMPLATE_DUPLICATE',
          cause: error,
        })
      }
      throw error
    }
  },

  async remove(id: string): Promise<void> {
    requireSupabase()
    const { data, error } = await supabase
      .from('gis_field_templates')
      .delete()
      .eq('id', id)
      .select('id')
    if (error) throw toServiceError(error)
    if (!data || data.length === 0) {
      throw new ServiceError('Template tidak ditemukan.', { code: 'TEMPLATE_NOT_FOUND' })
    }
  },
}
