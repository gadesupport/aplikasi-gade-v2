// Deklarasi minimal untuk paket `dxf` (belum menyediakan types).
declare module 'dxf' {
  export interface DxfEntity {
    type: string
    layer?: string
    handle?: string
    [key: string]: unknown
  }

  export interface DxfParsed {
    entities?: DxfEntity[]
    tables?: unknown
    blocks?: unknown
    header?: unknown
  }

  export function parseString(text: string): DxfParsed
  export function groupEntitiesByLayer(entities: DxfEntity[]): Record<string, DxfEntity[]>
}
