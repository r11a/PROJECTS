export function localDateValue(value = new Date()) {
  const dateOnly = typeof value === "string" ? value.match(/^(\d{4}-\d{2}-\d{2})/) : null;
  if (dateOnly) return dateOnly[1];
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function localDateTimeValue(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${localDateValue(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
export function dateOnlyValue(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : localDateValue(value);
}
export function formatDateIL(value) {
  if (!value) return "";
  const [year, month, day] = dateOnlyValue(value).split("-").map(Number);
  return year && month && day ? `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}` : String(value);
}
export const formatTimeIL = (value) => value ? String(value).slice(0, 5) : "";
