import { ApiSuccess, PageResult } from './response.interface';

export function ok<T>(
  data: T,
  message?: string,
  meta?: Record<string, any>,
): ApiSuccess<T> {
  return { success: true, message, data, meta };
}

export function okList<T>(
  result: PageResult<T>,
  message = 'List',
): ApiSuccess<T[]> {
  const { rows, total, page, pageSize, ...rest } = result;
  return {
    success: true,
    message,
    data: rows,
    meta: { total, page, pageSize, ...rest },
  };
}
