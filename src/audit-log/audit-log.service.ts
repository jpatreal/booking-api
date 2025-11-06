import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DB } from '@app/db';
import { auditLog } from '@app/db/schema';
import { InferInsertModel } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '@app/db/db.module';

type AuditLogRow = InferInsertModel<typeof auditLog>;

export interface AuditInput {
  businessId?: string | null;
  actorUserId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  meta?: Record<string, any> | null;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async log(input: AuditInput): Promise<void> {
    const row: AuditLogRow = {
      businessId: input.businessId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      meta: input.meta ?? null,
    };
    try {
      await this.db.insert(auditLog).values(row);
    } catch (e) {
      this.logger.error(
        `Audit insert failed: ${(e as Error).message}`,
        (e as Error).stack,
      );
    }
  }

  async logInTx(tx: any, input: AuditInput): Promise<void> {
    const row: AuditLogRow = {
      businessId: input.businessId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      meta: input.meta ?? null,
    };
    await tx.insert(auditLog).values(row);
  }

  buildMeta(extra?: Record<string, any>) {
    return extra ? JSON.parse(JSON.stringify(extra)) : null;
  }

  async pruneOlderThan(days = 365): Promise<number> {
    const rows = await this.db
      .delete(auditLog)
      .where(
        sql`${auditLog.createdAt} < now() - (${days} || ' days')::interval`,
      )
      .returning({ one: sql`1` });

    return rows.length;
  }
}
