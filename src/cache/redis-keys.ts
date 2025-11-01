export const RedisKeys = {
  userEmailById: (id: string) => `auth:user-email:${id}`,
  unknownEmailNeg: (email: string) => `auth:unknown-email:${email}`,
  signupKeyByHash: (hash: string) => `auth:signup-key:${hash}`,
  inviteToken: (token: string) => `auth:invite:${token}`,
  singleUseToken: (hash: string) => `auth:onet:${hash}`,
  rlLoginIP: (ip: string) => `rl:login:ip:${ip}`,
  rlLoginEmail: (email: string) => `rl:login:email:${email}`,
  rlRefreshIP: (ip: string) => `rl:refresh:ip:${ip}`,
  rlRegisterIP: (ip: string) => `rl:register:ip:${ip}`,
  rlRequestResetIP: (ip: string) => `rl:reqreset:ip:${ip}`,
  rlRequestResetEmail: (email: string) => `rl:reqreset:email:${email}`,

  // Users
  userById: (id: string) => `user:id:${id}`,
  userByEmail: (email: string) => `user:email:${email}`,
  userIdNeg: (id: string) => `user:id:neg:${id}`,
  userEmailNeg: (email: string) => `user:email:neg:${email}`,
  userLockById: (id: string) => `lock:user:id:${id}`,
  userLockByEmail: (e: string) => `lock:user:email:${e}`,
};
