import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';
import { outbox } from '@app/db/schema';
import { InferSelectModel, sql } from 'drizzle-orm';

type OutboxLocked = Pick<
  InferSelectModel<typeof outbox>,
  'id' | 'topic' | 'payload' | 'attempts'
>;

@Injectable()
export class OutboxDispatcher {
  private readonly log = new Logger(OutboxDispatcher.name);
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async tick(max = 50) {
    const rows = await this.db.transaction(async (tx) => {
      const res = await tx.execute<OutboxLocked>(sql`
      SELECT "id","topic","payload","attempts"
      FROM "Outbox"
      WHERE "processedAt" IS NULL
      ORDER BY "occurredAt"
      FOR UPDATE SKIP LOCKED
      LIMIT ${max};
    `);
      return res.rows;
    });

    for (const r of rows) {
      try {
        await this.handle(r.topic, r.payload);
        await this.db
          .update(outbox)
          .set({ processedAt: new Date() })
          .where(sql`"id" = ${r.id}`);
      } catch (e) {
        this.log.error(`Outbox ${r.id} failed`, e as any);
        await this.db
          .update(outbox)
          .set({ attempts: sql`"attempts"+1` })
          .where(sql`"id" = ${r.id}`);
      }
    }
  }

  private async handle(topic: string, payload: any) {
    switch (topic) {
      case 'booking.created':
        this.log.debug(`booking.created`, payload);
        return;
      case 'booking.status.changed':
        this.log.debug(`booking.status.changed`, payload);
        return;
      default:
        this.log.warn(`Unknown outbox topic: ${topic}`);
        return;
    }
  }
}
