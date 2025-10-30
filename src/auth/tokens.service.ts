import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { addDays } from 'date-fns';
import { SessionsRepository } from './sessions.repository';
import { sessionRevokedReason as revokedReasonEnum } from '@app/db/schema';
import { randomToken, sha256Base64 } from '../common/utils/crypto.util';

type RevokedReason = (typeof revokedReasonEnum.enumValues)[number];
interface ReqMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sessions: SessionsRepository,
  ) {}

  issueAccess(payload: any) {
    const ttlSeconds = this.config.get<number>('JWT_ACCESS_TTL') ?? 900;
    const secret = this.config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) throw new Error('JWT_ACCESS_SECRET is not configured');

    return this.jwt.signAsync(payload, {
      secret,
      expiresIn: ttlSeconds,
    });
  }

  async createSession(userId: string, reqMeta?: ReqMeta) {
    const raw = randomToken(48);
    const hash = this.hashRefreshToken(raw);

    const days =
      Number.parseInt(
        this.config.get<string>('REFRESH_TTL_DAYS') ?? '30',
        10,
      ) || 30;
    const expiresAt = addDays(new Date(), days);

    const session = await this.sessions.create(
      userId,
      hash,
      expiresAt,
      reqMeta?.ip,
      reqMeta?.userAgent,
    );

    return { session, rawToken: raw };
  }

  async rotateSession(oldRaw: string, userId: string, reqMeta?: ReqMeta) {
    try {
      const oldHash = this.hashRefreshToken(oldRaw);

      const db = (this.sessions as any).db;

      return db.transaction(async (tx: any) => {
        const existing = await this.sessions.findActiveByHash(oldHash);
        if (!existing || existing.userId !== userId) {
          return { valid: false as const };
        }

        await tx
          .update((this.sessions as any).table)
          .set({
            revokedAt: new Date(),
            revokedReason: 'rotated',
          })
          .where((this.sessions as any).idEq(existing.id));

        const raw = randomToken(48);
        const nextHash = this.hashRefreshToken(raw);

        const days =
          Number.parseInt(
            this.config.get<string>('REFRESH_TTL_DAYS') ?? '30',
            10,
          ) || 30;
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

        const [next] = await tx
          .insert((this.sessions as any).table)
          .values({
            userId,
            refreshTokenHash: nextHash,
            expiresAt,
            ip: reqMeta?.ip,
            userAgent: reqMeta?.userAgent,
          })
          .returning();

        return { valid: true as const, next: { session: next, rawToken: raw } };
      });
    } catch (error) {
      throw error;
    }
  }

  async revokeByRaw(raw: string, reason: RevokedReason = 'logout') {
    const hash = this.hashRefreshToken(raw);
    await this.sessions.revokeByHashActive(hash, reason);
  }

  async revokeAllForUser(userId: string, reason: RevokedReason = 'admin') {
    await this.sessions.revokeAllForUser(userId, reason);
  }

  private hashRefreshToken(raw: string) {
    const pepper = this.config.get<string>('REFRESH_TOKEN_PEPPER') ?? '';
    return sha256Base64(raw + pepper);
  }
}
