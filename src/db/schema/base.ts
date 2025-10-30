import { uuid, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const baseModel = {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' })
    .default(sql`now()`)
    .notNull(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' })
    .default(sql`now()`)
    .notNull()
    .$onUpdateFn(() => new Date()),
  deletedAt: timestamp('deletedAt', { withTimezone: true, mode: 'date' }),
};
