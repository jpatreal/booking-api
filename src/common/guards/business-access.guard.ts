import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Inject,
} from '@nestjs/common';
import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';
import { REQ_AUTHZ_KEY } from '../constants/authz.constants';

@Injectable()
export class BusinessAccessGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();

    const userId: string | undefined = req.user?.sub ?? req.user?.id;
    if (!userId) throw new ForbiddenException('No user in request');

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

    req[REQ_AUTHZ_KEY] = {
      userId,
      businessId: membership.businessId,
      role: membership.role,
    };

    return true;
  }
}
