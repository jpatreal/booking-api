import { Injectable, Inject } from '@nestjs/common';
import type { DB } from '@app/db';
import { BaseRepository } from '@app/common/db/base.repository';
import {
  sessions,
  sessionRevokedReason as revokedReasonEnum,
} from '@app/db/schema';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { DRIZZLE } from '@app/db/db.module';

type RevokedReason = (typeof revokedReasonEnum.enumValues)[number];

export type SessionFilters = {
  userId?: string;
  activeOnly?: boolean;
};

@Injectable()
export class SessionsRepository extends BaseRepository<typeof sessions> {
  constructor(@Inject(DRIZZLE) db: DB) {
    super(db, sessions, sessions.id);
  }

  protected buildWhere(f?: SessionFilters) {
    const now = new Date();
    return and(
      f?.userId ? eq(sessions.userId, f.userId) : undefined,
      f?.activeOnly
        ? and(isNull(sessions.revokedAt), gt(sessions.expiresAt, now))
        : undefined,
    );
  }

  async findActiveByHash(hash: string) {
    const now = new Date();
    const [row] = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.refreshTokenHash, hash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(
    userId: string,
    hash: string,
    expiresAt: Date,
    ip?: string,
    userAgent?: string,
  ) {
    const [row] = await this.db
      .insert(sessions)
      .values({
        userId,
        refreshTokenHash: hash,
        expiresAt: expiresAt,
        ip,
        userAgent,
        createdAt: new Date(),
      })
      .returning();
    return row;
  }

  async revokeById(id: string, reason: RevokedReason) {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(eq(sessions.id, id));
  }

  async revokeByHashActive(hash: string, reason: RevokedReason) {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(
        and(eq(sessions.refreshTokenHash, hash), isNull(sessions.revokedAt)),
      );
  }

  async revokeAllForUser(userId: string, reason: RevokedReason) {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }
}
