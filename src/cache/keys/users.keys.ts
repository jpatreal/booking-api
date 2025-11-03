import { ns } from './_util';

const USER = ns('user');
const LOCK = ns('lock');
const RL = ns('rl');

export const UserKeys = {
  userById: (id: string) => USER['id'](id),
  userByEmail: (email: string) => USER['email'](email),
  userIdNeg: (id: string) => USER['id:neg'](id),
  userEmailNeg: (email: string) => USER['email:neg'](email),
  userLockById: (id: string) => LOCK['user:id'](id),
  userLockByEmail: (e: string) => LOCK['user:email'](e),

  rlUserListIP: (ip: string) => RL['user:list']('ip', ip),
  rlUserGetIP: (ip: string) => RL['user:get']('ip', ip),
  rlUserCreateIP: (ip: string) => RL['user:create']('ip', ip),
  rlUserCreate: () => RL['user:create']('global'),
  rlUserUpdate: (userId: string) => RL['user:update']('id', userId),
  rlUserUpdateIP: (userId: string, ip: string) =>
    RL['user:update']('id', userId, 'ip', ip),
} as const;
