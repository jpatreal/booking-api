import { ns } from './_util';

const BIZ = ns('biz');
const LOCK = ns('lock');
const RL = ns('rl');

export const BusinessKeys = {
  bizById: (id: string) => BIZ['id'](id),
  bizBySlug: (slug: string) => BIZ['slug'](slug),
  bizNegId: (id: string) => BIZ['id:neg'](id),
  bizNegSlug: (slug: string) => BIZ['slug:neg'](slug),
  bizHours: (id: string) => BIZ['hours'](id),

  bizListVer: (userId: string) => BIZ['list:ver'](userId),
  bizListKey: (
    userId: string,
    ver: number | string,
    q?: string,
    page?: number,
    pageSize?: number,
    includeDeleted?: boolean,
  ) =>
    BIZ['list'](
      `v${ver}`,
      `u=${userId}`,
      `q=${q ?? ''}`,
      `p=${page ?? 1}`,
      `ps=${pageSize ?? 20}`,
      `del=${!!includeDeleted}`,
    ),

  bizLockId: (id: string) => LOCK['biz:id'](id),
  bizLockSlug: (slug: string) => LOCK['biz:slug'](slug),
  bizLockList: (sig: string) => LOCK['biz:list'](sig),

  rlBizListUserIP: (userId: string, ip: string) =>
    RL['biz:list']('user', userId, 'ip', ip),

  rlBizGetIP: (bizId: string, ip: string) =>
    RL['biz:get']('biz', bizId, 'ip', ip),

  rlBizHoursIP: (bizId: string, ip: string) =>
    RL['biz:hours']('biz', bizId, 'ip', ip),

  rlBizCreateUser: (userId: string) => RL['biz:create']('user', userId),

  rlBizCreateIP: (ip: string) => RL['biz:create']('ip', ip),

  rlBizUpdate: (bizId: string) => RL['biz:update']('biz', bizId),

  rlBizUpdateIP: (bizId: string, ip: string) =>
    RL['biz:update']('biz', bizId, 'ip', ip),

  rlBizDelete: (bizId: string) => RL['biz:delete']('biz', bizId),

  rlBizDeleteIP: (bizId: string, ip: string) =>
    RL['biz:delete']('biz', bizId, 'ip', ip),

  rlBizRestore: (bizId: string) => RL['biz:restore']('biz', bizId),

  rlBizRestoreIP: (bizId: string, ip: string) =>
    RL['biz:restore']('biz', bizId, 'ip', ip),

  rlBizReplaceHours: (bizId: string) => RL['biz:hours:replace']('biz', bizId),

  rlBizReplaceHoursIP: (bizId: string, ip: string) =>
    RL['biz:hours:replace']('biz', bizId, 'ip', ip),

  rlBizSubscriptionIP: (businessId: string, ip: string) =>
    `rl:biz:${businessId}:subscription:${ip}`,
} as const;
