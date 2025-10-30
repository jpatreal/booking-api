import { DB } from '@app/db';
import { DRIZZLE } from '@app/db/db.module';
import { memberships } from '@app/db/schema';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class MembershipsService {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async ensureOwnerMembership(userId: string, businessId: string) {
    const [membership] = await this.db
      .insert(memberships)
      .values({ userId, businessId, role: 'OWNER' })
      .returning();
    return membership;
  }
}
