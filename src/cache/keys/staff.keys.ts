export const StaffKeys = {
  staffById: (bizId: string, staffId: string) => `staff:${bizId}:id:${staffId}`,
  staffNegId: (bizId: string, staffId: string) =>
    `staff:${bizId}:id:neg:${staffId}`,
  staffListVer: (bizId: string) => `staff:${bizId}:list:ver`,
  staffListKey: (
    bizId: string,
    ver: number | string,
    q?: string,
    page?: number,
    pageSize?: number,
    activeOnly?: boolean,
  ) =>
    `staff:${bizId}:list:v${ver}:q=${q ?? ''}:p=${page ?? 1}:ps=${pageSize ?? 20}:active=${!!activeOnly}`,

  staffSvcVer: (staffId: string) => `staff:${staffId}:svc:ver`,
  staffAvailVer: (staffId: string) => `staff:${staffId}:avail:ver`,
  staffToVer: (staffId: string) => `staff:${staffId}:to:ver`,

  staffSvcKey: (staffId: string, ver: number | string) =>
    `staff:${staffId}:svc:v${ver}`,
  staffAvailKey: (staffId: string, ver: number | string) =>
    `staff:${staffId}:avail:v${ver}`,
  staffToKey: (staffId: string, ver: number | string) =>
    `staff:${staffId}:to:v${ver}`,

  staffLockId: (bizId: string, staffId: string) =>
    `lock:staff:${bizId}:id:${staffId}`,
  staffLockList: (bizId: string, sig: string) =>
    `lock:staff:${bizId}:list:${sig}`,
  staffLockSvc: (staffId: string) => `lock:staff:${staffId}:svc`,
  staffLockAvail: (staffId: string) => `lock:staff:${staffId}:avail`,
  staffLockTo: (staffId: string) => `lock:staff:${staffId}:to`,

  rlStaffListIP: (bizId: string, ip: string) =>
    `rl:staff:list:biz:${bizId}:ip:${ip}`,
  rlStaffGetIP: (bizId: string, ip: string) =>
    `rl:staff:get:biz:${bizId}:ip:${ip}`,

  rlStaffCreateBiz: (bizId: string) => `rl:staff:create:biz:${bizId}`,
  rlStaffCreateIP: (bizId: string, ip: string) =>
    `rl:staff:create:biz:${bizId}:ip:${ip}`,

  rlStaffUpdate: (bizId: string, staffId: string) =>
    `rl:staff:update:${bizId}:${staffId}`,
  rlStaffUpdateIP: (bizId: string, staffId: string, ip: string) =>
    `rl:staff:update:${bizId}:${staffId}:ip:${ip}`,

  rlStaffDelete: (bizId: string, staffId: string) =>
    `rl:staff:delete:${bizId}:${staffId}`,
  rlStaffDeleteIP: (bizId: string, staffId: string, ip: string) =>
    `rl:staff:delete:${bizId}:${staffId}:ip:${ip}`,

  rlStaffSvcUpsert: (staffId: string) => `rl:staff:svc:upsert:${staffId}`,
  rlStaffSvcOverride: (staffId: string) => `rl:staff:svc:override:${staffId}`,
  rlStaffSvcDelete: (staffId: string, svcId: string) =>
    `rl:staff:svc:del:${staffId}:${svcId}`,

  rlStaffAvailUpsert: (staffId: string) => `rl:staff:avail:upsert:${staffId}`,
  rlStaffAvailDel: (staffId: string, dow: number) =>
    `rl:staff:avail:del:${staffId}:${dow}`,

  rlStaffToList: (staffId: string) => `rl:staff:to:list:${staffId}`,
  rlStaffToCreate: (staffId: string) => `rl:staff:to:create:${staffId}`,
  rlStaffToDelete: (staffId: string, toId: string) =>
    `rl:staff:to:del:${staffId}:${toId}`,

  rlStaffWalkIn: (staffId: string) => `rl:staff:walkin:${staffId}`,
} as const;
