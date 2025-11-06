import { AuthKeys } from './keys/auth.keys';
import { UserKeys } from './keys/users.keys';
import { ServiceKeys } from './keys/services.keys';
import { BusinessKeys } from './keys/businesses.keys';
import { StaffKeys } from './keys/staff.keys';
import { MembershipKeys } from './keys/memberships.keys';
import { InviteKeys } from './keys/membership-invites.keys';
import { BookingKeys } from './keys/booking-keys';

export const RedisKeys = {
  ...AuthKeys,
  ...UserKeys,
  ...ServiceKeys,
  ...BusinessKeys,
  ...StaffKeys,
  ...MembershipKeys,
  ...InviteKeys,
  ...BookingKeys,
} as const;

export {
  AuthKeys,
  UserKeys,
  ServiceKeys,
  BusinessKeys,
  StaffKeys,
  MembershipKeys,
  InviteKeys,
  BookingKeys,
};

export type RedisKeyFns = typeof RedisKeys;
