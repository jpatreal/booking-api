import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';

@Injectable()
export class MembershipGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();

    const userId: string | undefined = req.user?.sub;
    if (!userId) throw new UnauthorizedException();

    const businessId: string | undefined =
      req.params?.businessId ||
      (req.headers['x-business-id'] as string | undefined);

    if (!businessId) throw new ForbiddenException('Business context required');

    const membership = await this.db.query.memberships.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.userId, userId), eq(t.businessId, businessId)),
      columns: { role: true, businessId: true },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this business');
    }

    req.authz = {
      userId,
      businessId: membership.businessId,
      role: membership.role,
    };
    return true;
  }
}
