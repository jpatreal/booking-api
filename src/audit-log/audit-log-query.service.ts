import { Inject, Injectable } from '@nestjs/common';
import type { DB } from '@app/db';
import { DRIZZLE } from '@app/db/db.module';
import { auditLog } from '@app/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { QueryAuditDto } from './dto/query-audit.dto';
import { Readable } from 'node:stream';

type Row = {
  id: string;
  businessId: string | null;
  actorUserId: string | null;
  action: string;
  entity: string;
  entityId: string;
  meta: any | null;
  createdAt: Date | null;
};

function encodeCursor(d: Date, id: string) {
  return Buffer.from(`${d.toISOString()}|${id}`, 'utf8').toString('base64');
}
function decodeCursor(cur: string) {
  const [iso, id] = Buffer.from(cur, 'base64').toString('utf8').split('|');
  return { createdAt: new Date(iso), id };
}

@Injectable()
export class AuditLogQueryService {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async list(q: QueryAuditDto) {
    const take = Math.min(Math.max(q.take ?? 50, 1), 200);
    const filters = [];

    if (q.businessId) filters.push(eq(auditLog.businessId, q.businessId));
    if (q.actorUserId) filters.push(eq(auditLog.actorUserId, q.actorUserId));
    if (q.entity) filters.push(eq(auditLog.entity, q.entity));
    if (q.action) filters.push(eq(auditLog.action, q.action));
    if (q.dateFrom)
      filters.push(gteDate(auditLog.createdAt, new Date(q.dateFrom)));
    if (q.dateTo) filters.push(ltDate(auditLog.createdAt, new Date(q.dateTo)));

    if (q.cursor) {
      const { createdAt, id } = decodeCursor(q.cursor);
      filters.push(
        sql`${auditLog.createdAt} < ${createdAt} OR (${auditLog.createdAt} = ${createdAt} AND ${auditLog.id} < ${id})`,
      );
    }

    const rows = await this.db
      .select()
      .from(auditLog)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(take + 1);

    let nextCursor: string | null = null;
    if (rows.length > take) {
      const last = rows[take - 1] as Row;
      nextCursor = last.createdAt
        ? encodeCursor(last.createdAt, last.id)
        : null;
      rows.length = take;
    }

    return { rows, nextCursor };
  }

  streamExport(q: QueryAuditDto): Readable {
    const stream = new Readable({ read() {} });
    (async () => {
      try {
        if (q.format === 'csv' || !q.format) {
          stream.push(
            'id,businessId,actorUserId,action,entity,entityId,createdAt,meta\n',
          );
        }
        let cursor = q.cursor ?? null;
        const pageSize = Math.min(Math.max(q.take ?? 1000, 100), 5000);

        const base: QueryAuditDto = { ...q, cursor: null, take: pageSize };

        while (true) {
          const { rows, nextCursor } = await this.list({ ...base, cursor });
          if (!rows.length) break;

          for (const r of rows as Row[]) {
            if (q.format === 'ndjson') {
              stream.push(JSON.stringify(r) + '\n');
            } else {
              const line =
                [
                  r.id,
                  r.businessId ?? '',
                  r.actorUserId ?? '',
                  r.action,
                  r.entity,
                  r.entityId,
                  (r.createdAt ?? undefined)?.toISOString() ?? '',
                  safeJson(r.meta),
                ]
                  .map(csvCell)
                  .join(',') + '\n';
              stream.push(line);
            }
          }

          if (!nextCursor) break;
          cursor = nextCursor;
        }

        stream.push(null);
      } catch (err) {
        stream.destroy(err as Error);
      }
    })();
    return stream;
  }
}

function csvCell(v: string) {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function safeJson(obj: unknown) {
  if (obj == null) return '';
  try {
    return JSON.stringify(obj);
  } catch {
    return '';
  }
}

function gteDate(col: any, d: Date) {
  return sql`${col} >= ${d}`;
}
function ltDate(col: any, d: Date) {
  return sql`${col} < ${d}`;
}
