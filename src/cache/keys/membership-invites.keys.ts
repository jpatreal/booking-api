import { ns } from './_util';

const INV = ns('inv');
const LOCK = ns('lock');
const RL = ns('rl');

export const InviteKeys = {
  invListVer: (bizId: string) => INV['list:ver'](bizId),
  invListKey: (bizId: string, ver: number | string) =>
    INV['list'](`v${ver}`, `biz:${bizId}`),

  invByTok: (hash: string) => INV['tok'](hash),
  invTokNeg: (hash: string) => INV['tok:neg'](hash),

  invLockList: (bizId: string) => LOCK['inv:list'](bizId),
  invLockTok: (hash: string) => LOCK['inv:tok'](hash),

  rlInvCreateBiz: (bizId: string) => RL['inv:create']('biz', bizId),
  rlInvCreateIP: (bizId: string, ip: string) =>
    RL['inv:create']('biz', bizId, 'ip', ip),
  rlInvResendBiz: (bizId: string) => RL['inv:resend']('biz', bizId),
  rlInvResendIP: (bizId: string, ip: string) =>
    RL['inv:resend']('biz', bizId, 'ip', ip),
  rlInvCancel: (inviteId: string) => RL['inv:cancel'](inviteId),
  rlInvListIP: (bizId: string, ip: string) =>
    RL['inv:list']('biz', bizId, 'ip', ip),
  rlInvVerifyIP: (ip: string) => RL['inv:verify']('ip', ip),
  rlInvAcceptUser: (userId: string) => RL['inv:accept']('user', userId),
} as const;
