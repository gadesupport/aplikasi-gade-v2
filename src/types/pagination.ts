// Hasil list dengan pagination — dipakai bersama semua service.
export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
