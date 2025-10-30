import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];

    if (!required.length) return true;

    const req = ctx.switchToHttp().getRequest();

    const role =
      req.authz?.role ??
      req.user?.role ??
      req.authz?.membership?.role ??
      req.user?.membership?.role;

    if (!role) {
      throw new ForbiddenException('Insufficient role (no role in request)');
    }

    if (!required.includes(role)) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
