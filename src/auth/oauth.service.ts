import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';
import { users } from '@app/db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class OauthService {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async upsertGoogleUser(google: {
    email: string;
    emailVerified?: boolean;
    name?: string;
  }) {
    const normalizedEmail = google.email.trim().toLowerCase();

    const existing = await this.db.query.users.findFirst({
      where: (t, { eq }) => eq(t.email, normalizedEmail),
    });

    if (existing) {
      if (google.emailVerified && !existing.emailVerifiedAt) {
        await this.db
          .update(users)
          .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
          .where(eq(users.id, existing.id));
      }
      return existing;
    }

    const [created] = await this.db
      .insert(users)
      .values({
        email: normalizedEmail,
        emailVerifiedAt: google.emailVerified ? new Date() : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return created;
  }
}
