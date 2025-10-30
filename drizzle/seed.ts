import 'dotenv/config';
import { makeDb } from '../src/db';
import { users, businesses, memberships } from '../src/db/schema';
import * as argon2 from 'argon2';

async function run() {
  const { db, pool } = (() => {
    const url = process.env.DATABASE_URL!;
    return { ...makeDb(url), pool: undefined as any };
  })() as any;

  const passwordHash = await argon2.hash('admin123');

  const [u] = await db
    .insert(users)
    .values({
      email: 'owner@example.com',
      passwordHash,
    })
    .onConflictDoNothing()
    .returning();

  const [b] = await db
    .insert(businesses)
    .values({
      name: 'Demo Salon',
      slug: 'demo-salon',
    })
    .onConflictDoNothing()
    .returning();

  if (u && b) {
    await db
      .insert(memberships)
      .values({
        userId: u.id,
        businessId: b.id,
        role: 'OWNER',
      })
      .onConflictDoNothing();
  }

  if (pool?.end) await pool.end();
  console.log('✅ Seed complete');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
