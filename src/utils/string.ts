export function stringOrUndefined(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : String(value);
}
