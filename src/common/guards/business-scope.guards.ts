import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';

@Injectable()
export class BusinessScopeGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();

    const user = req.user as { sub: string } | undefined;
    if (!user) throw new UnauthorizedException();

    const businessId = req.headers['x-business-id'] as string | undefined;
    if (!businessId) throw new ForbiddenException('x-business-id required');

    const membership = await this.db.query.memberships.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.userId, user.sub), eq(t.businessId, businessId)),
    });

    if (!membership)
      throw new ForbiddenException('Not a member of this business');

    req.membership = {
      id: membership.id,
      biz: membership.businessId,
      role: membership.role,
    };

    return true;
  }
}
