export const POSTGRES_DATE_OID = 1082;

export function installPostgresDateOnlyParser(types) {
  // PostgreSQL DATE is a calendar value, not an instant in time.
  types.setTypeParser(POSTGRES_DATE_OID, (value) => value);
}

export function normalizeDateOnly(value) {
  const text = String(value ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const checked = new Date(Date.UTC(year, month - 1, day));
  if (
    checked.getUTCFullYear() !== year ||
    checked.getUTCMonth() !== month - 1 ||
    checked.getUTCDate() !== day
  ) return null;

  return text;
}
