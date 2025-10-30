export function asDate(input: unknown): Date {
  if (input instanceof Date) return input;
  const d = new Date(input as any);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid Date value');
  return d;
}
