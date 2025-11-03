export const BusinessKeys = {
  bizById: (id: string) => `biz:id:${id}`,
  bizBySlug: (slug: string) => `biz:slug:${slug}`,
  bizNegId: (id: string) => `biz:id:neg:${id}`,
  bizNegSlug: (slug: string) => `biz:slug:neg:${slug}`,
  bizHours: (id: string) => `biz:hours:${id}`,

  bizListVer: (userId: string) => `biz:list:ver:${userId}`,
  bizListKey: (
    userId: string,
    ver: number | string,
    q?: string,
    page?: number,
    pageSize?: number,
    includeDeleted?: boolean,
  ) =>
    `biz:list:v${ver}:u=${userId}:q=${q ?? ''}:p=${page ?? 1}:ps=${pageSize ?? 20}:del=${!!includeDeleted}`,

  bizLockId: (id: string) => `lock:biz:id:${id}`,
  bizLockSlug: (slug: string) => `lock:biz:slug:${slug}`,
  bizLockList: (hash: string) => `lock:biz:list:${hash}`,
} as const;
