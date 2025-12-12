export function isUUID(value: string): boolean {
  if (typeof value !== 'string') return false;

  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

  return uuidRegex.test(value);
}
