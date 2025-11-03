import { ns } from './_util';

const SVC = ns('svc');
const LOCK = ns('lock');
const RL = ns('rl');

export const ServiceKeys = {
  svcById: (bizId: string, id: string) => SVC[bizId]('id', id),
  svcIdNeg: (bizId: string, id: string) => SVC[bizId]('id:neg', id),
  svcListVer: (bizId: string) => SVC[bizId]('ver'),
  svcListKey: (
    bizId: string,
    ver: number | string,
    q: string | undefined,
    page?: number,
    pageSize?: number,
  ) =>
    SVC[bizId](
      'list',
      `v${ver}`,
      `q=${q ?? ''}`,
      `p=${page ?? 1}`,
      `ps=${pageSize ?? 20}`,
    ),
  svcLockId: (bizId: string, id: string) => LOCK['svc'](bizId, 'id', id),
  svcLockList: (bizId: string, hash: string) =>
    LOCK['svc'](bizId, 'list', hash),

  rlSvcListIP: (bizId: string, ip: string) =>
    RL['svc:list']('biz', bizId, 'ip', ip),
  rlSvcGetIP: (bizId: string, ip: string) =>
    RL['svc:get']('biz', bizId, 'ip', ip),
  rlSvcCreateBiz: (bizId: string) => RL['svc:create']('biz', bizId),
  rlSvcCreateIP: (bizId: string, ip: string) =>
    RL['svc:create']('biz', bizId, 'ip', ip),
  rlSvcUpdate: (bizId: string, id: string) =>
    RL['svc:update']('biz', bizId, 'id', id),
  rlSvcUpdateIP: (bizId: string, id: string, ip: string) =>
    RL['svc:update']('biz', bizId, 'id', id, 'ip', ip),
  rlSvcDelete: (bizId: string, id: string) =>
    RL['svc:delete']('biz', bizId, 'id', id),
  rlSvcDeleteIP: (bizId: string, id: string, ip: string) =>
    RL['svc:delete']('biz', bizId, 'id', id, 'ip', ip),
  rlSvcRestore: (bizId: string, id: string) =>
    RL['svc:restore']('biz', bizId, 'id', id),
  rlSvcRestoreIP: (bizId: string, id: string, ip: string) =>
    RL['svc:restore']('biz', bizId, 'id', id, 'ip', ip),
} as const;
