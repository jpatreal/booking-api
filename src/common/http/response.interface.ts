export type ApiSuccess<T = unknown> = {
  success: true;
  message?: string;
  data: T;
  meta?: Record<string, any>;
};

export type ApiError = {
  success: false;
  message: string;
  code?: string | number;
  errors?: Record<string, any> | string[];
};

export type PageMeta = {
  total: number;
  page: number;
  pageSize: number;
  [k: string]: any;
};

export type PageResult<T = any> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  [k: string]: any;
};
