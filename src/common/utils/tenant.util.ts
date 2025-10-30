import { eq } from 'drizzle-orm';
import { memberships, businesses } from '@app/db/schema';
import type { DB } from '@app/db';
import { UnauthorizedException } from '@nestjs/common';

export async function assertUserEnabled(db: DB, userId: string) {
  const u = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.id, userId),
  });
  if (!u || u.disabledAt)
    throw new UnauthorizedException('User disabled or not found');
}

export async function getActiveMemberships(db: DB, userId: string) {
  const rows = await db
    .select({
      mId: memberships.id,
      role: memberships.role,
      bizId: businesses.id,
      status: businesses.status,
      trialEndsAt: businesses.trialEndsAt,
      suspendedAt: businesses.suspendedAt,
      planRenewsAt: businesses.planRenewsAt,
      plan: businesses.plan,
    })
    .from(memberships)
    .innerJoin(businesses, eq(memberships.businessId, businesses.id))
    .where(eq(memberships.userId, userId));
  return rows;
}

export function businessIsAccessible(row: {
  status: any;
  trialEndsAt: Date | null;
  suspendedAt: Date | null;
  planRenewsAt: Date | null;
}) {
  const now = new Date();
  if (row.suspendedAt) return false;
  if (row.status === 'trialing')
    return !!row.trialEndsAt && row.trialEndsAt > now;
  if (row.status === 'active') return true;
  if (row.status === 'past_due') return false;
  if (row.status === 'canceled') return false;
  return false;
}
