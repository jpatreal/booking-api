import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';

import {
  businesses as biz,
  memberships as mem,
  users as u,
  roleEnum,
} from '@app/db/schema';
import { membershipInvites } from '@app/db/schema';

type Role = (typeof roleEnum.enumValues)[number];

type TxOrDb = DB;

@Injectable()
export class MembershipInviteRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async getBusinessById(businessId: string, db: TxOrDb = this.db) {
    const [row] = await db
      .select()
      .from(biz)
      .where(eq(biz.id, businessId))
      .limit(1);
    return row ?? null;
  }

  async getUserById(userId: string, db: any) {
    const [row] = await db.select().from(u).where(eq(u.id, userId)).limit(1);
    return row ?? null;
  }

  async findExistingMemberByBusinessEmail(
    businessId: string,
    emailLower: string,
    db: TxOrDb = this.db,
  ) {
    const rows = await db
      .select({ id: mem.id })
      .from(mem)
      .leftJoin(u, eq(u.id, mem.userId))
      .where(and(eq(mem.businessId, businessId), eq(u.email, emailLower)))
      .limit(1);
    return rows.length ? rows[0] : null;
  }

  async findActiveInviteByEmail(
    businessId: string,
    emailLower: string,
    now: Date,
    db: TxOrDb = this.db,
  ) {
    const [row] = await db
      .select()
      .from(membershipInvites)
      .where(
        and(
          eq(membershipInvites.businessId, businessId),
          eq(membershipInvites.email, emailLower),
          isNull(membershipInvites.acceptedAt),
          gt(membershipInvites.expiresAt, now),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async expireInviteNow(inviteId: string, now: Date, db: TxOrDb = this.db) {
    const [updated] = await db
      .update(membershipInvites)
      .set({ expiresAt: now })
      .where(eq(membershipInvites.id, inviteId))
      .returning();
    return updated ?? null;
  }

  async insertInvite(
    values: {
      businessId: string;
      email: string;
      role: Role;
      tokenHash: string;
      expiresAt: Date;
    },
    db: TxOrDb = this.db,
  ) {
    const [invite] = await db
      .insert(membershipInvites)
      .values(values)
      .returning();
    return invite;
  }

  async getInviteById(inviteId: string, db: TxOrDb = this.db) {
    const [row] = await db
      .select()
      .from(membershipInvites)
      .where(eq(membershipInvites.id, inviteId))
      .limit(1);
    return row ?? null;
  }

  async rotateInviteTokenAndExpiry(
    inviteId: string,
    tokenHash: string,
    expiresAt: Date,
    db: TxOrDb = this.db,
  ) {
    const [updated] = await db
      .update(membershipInvites)
      .set({ tokenHash, expiresAt })
      .where(eq(membershipInvites.id, inviteId))
      .returning();
    return updated ?? null;
  }

  async getInviteByTokenHash(tokenHash: string, db: any) {
    const [row] = await db
      .select()
      .from(membershipInvites)
      .where(eq(membershipInvites.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  }

  async markInviteAccepted(inviteId: string, acceptedAt: Date, db: any) {
    const [updated] = await db
      .update(membershipInvites)
      .set({ acceptedAt })
      .where(eq(membershipInvites.id, inviteId))
      .returning();
    return updated ?? null;
  }

  async listPendingByBusiness(
    businessId: string,
    now: Date,
    db: TxOrDb = this.db,
  ) {
    return db
      .select()
      .from(membershipInvites)
      .where(
        and(
          eq(membershipInvites.businessId, businessId),
          isNull(membershipInvites.acceptedAt),
          gt(membershipInvites.expiresAt, now),
        ),
      )
      .orderBy(desc(membershipInvites.expiresAt));
  }

  async createMembership(
    values: { businessId: string; userId: string; role: Role },
    db: any,
  ) {
    const [inserted] = await db.insert(mem).values(values).returning();
    return inserted;
  }

  async findMembershipByBusinessAndUser(
    businessId: string,
    userId: string,
    db: any,
  ) {
    const rows = await db
      .select({ id: mem.id })
      .from(mem)
      .where(and(eq(mem.businessId, businessId), eq(mem.userId, userId)))
      .limit(1);
    return rows.length ? rows[0] : null;
  }
}
