import slugify from 'slugify';
import { eq } from 'drizzle-orm';
import type { AnyPgTable } from 'drizzle-orm/pg-core';

export async function generateUniqueSlug<
  T extends AnyPgTable & { slug: unknown },
>(db: any, table: T, name: string): Promise<string> {
  const base = slugify(name, { lower: true, strict: true });
  let slug = base;
  let i = 1;

  while (true) {
    const exists = await db
      .select({ s: (table as any).slug })
      .from(table as AnyPgTable)
      .where(eq((table as any).slug, slug))
      .limit(1);

    if (exists.length === 0) return slug;
    slug = `${base}-${i++}`;
  }
}
