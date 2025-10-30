export type PaginatedResult<T> = {
  data: T[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
};
