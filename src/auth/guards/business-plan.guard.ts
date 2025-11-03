import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';
import { businesses } from '@app/db/schema';
import { eq } from 'drizzle-orm';
import { businessIsAccessible } from '@app/common/utils/tenant.util';

@Injectable()
export class BusinessPlanGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<any>();
    const bizId =
      req.headers['x-business-id'] ||
      req.params['businessId'] ||
      req.query['businessId'];
    if (!bizId) return true;

    const [row] = await this.db
      .select()
      .from(businesses)
      .where(eq(businesses.id, String(bizId)))
      .limit(1);
    if (!row || !businessIsAccessible(row))
      throw new ForbiddenException('Business plan inactive or trial expired.');
    return true;
  }
}
