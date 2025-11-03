import { ns } from './_util';

const MEM = ns('mem');
const RL = ns('rl');
const LOCK = ns('lock');

export const MembershipKeys = {
  memById: (id: string) => MEM['id'](id),
  memNegId: (id: string) => MEM['id:neg'](id),

  memListVer: (bizId: string) => MEM['list:ver'](bizId),
  memListKey: (bizId: string, ver: number | string, sig: string) =>
    MEM['list'](`v${ver}`, `biz:${bizId}`, `sig:${sig}`),

  ownersCount: (bizId: string) => MEM['owners:count'](bizId),

  memLockId: (id: string) => LOCK['mem:id'](id),
  memLockList: (bizId: string, sig: string) => LOCK['mem:list'](bizId, sig),

  rlMemListIP: (bizId: string, ip: string) =>
    RL['mem:list']('biz', bizId, 'ip', ip),
  rlMemCreateBiz: (bizId: string) => RL['mem:create']('biz', bizId),
  rlMemCreateIP: (bizId: string, ip: string) =>
    RL['mem:create']('biz', bizId, 'ip', ip),
  rlMemChangeRole: (membershipId: string) => RL['mem:role'](membershipId),
  rlMemDisable: (membershipId: string) => RL['mem:disable'](membershipId),
  rlMemEnable: (membershipId: string) => RL['mem:enable'](membershipId),
  rlMemDelete: (membershipId: string) => RL['mem:delete'](membershipId),
  rlMemTransfer: (bizId: string) => RL['mem:transfer'](bizId),
} as const;
