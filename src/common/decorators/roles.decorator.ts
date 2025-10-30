import { SetMetadata } from '@nestjs/common';
export type RoleType = 'OWNER' | 'MANAGER' | 'STAFF';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: RoleType[]) => SetMetadata(ROLES_KEY, roles);
