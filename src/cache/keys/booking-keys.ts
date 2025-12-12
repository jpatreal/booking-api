export const BookingKeys = {
  availability: (businessId: string, staffId: string, isoDateLocal: string) =>
    `book:avail:${businessId}:${staffId}:${isoDateLocal}`,
  freeSlots: (
    businessId: string,
    serviceId: string,
    staffId: string,
    isoDateLocal: string,
  ) => `book:slots:${businessId}:${serviceId}:${staffId}:${isoDateLocal}`,
  listHash: (businessId: string, hash: string) =>
    `book:list:${businessId}:${hash}`,

  rlCreateIP: (ip: string) => `rl:book:create:ip:${ip}`,
  rlReschedIP: (ip: string) => `rl:book:resched:ip:${ip}`,
  rlConfirmIP: (ip: string) => `rl:book:confirm:ip:${ip}`,
  rlCancelIP: (ip: string) => `rl:book:cancel:ip:${ip}`,
  rlStatusIP: (ip: string) => `rl:book:status:ip:${ip}`,

  rlPubAvailIP: (businessId: string, ip: string) =>
    `rl:pub:book:avail:${businessId}:${ip}`,
  rlPubCreateIP: (businessId: string, ip: string) =>
    `rl:pub:book:create:${businessId}:${ip}`,
  rlPubStatusIP: (businessId: string, ip: string) =>
    `rl:pub:status:${businessId}:${ip}`,

  idemPublic: (businessId: string, key: string) =>
    `idem:pub:book:${businessId}:${key}`,
  idemAdmin: (businessId: string, key: string) =>
    `idem:adm:book:${businessId}:${key}`,
} as const;
