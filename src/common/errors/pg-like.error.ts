export type PgLikeError = {
  code?: string;
  constraint?: string;
  detail?: string;
  table?: string;
  schema?: string;
};

function unwrapPgError(e: any): PgLikeError | null {
  if (e?.cause && typeof e.cause === 'object') return e.cause as PgLikeError;
  if (e?.originalError && typeof e.originalError === 'object')
    return e.originalError as PgLikeError;
  if (e && typeof e === 'object' && ('code' in e || 'constraint' in e))
    return e as PgLikeError;
  return null;
}

export function isUniqueViolation(
  e: any,
  constraint?: string | RegExp,
): boolean {
  const pg = unwrapPgError(e);
  if (!pg) return false;
  if (pg.code !== '23505') return false;
  if (!constraint) return true;
  const c = pg.constraint ?? '';
  return typeof constraint === 'string' ? c === constraint : constraint.test(c);
}

export function pgConstraint(e: any): string | undefined {
  return unwrapPgError(e)?.constraint;
}

export function pgCode(e: any): string | undefined {
  return unwrapPgError(e)?.code;
}
