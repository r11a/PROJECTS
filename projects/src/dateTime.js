export function localDateValue(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function formatDateIL(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return year && month && day ? `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}` : String(value);
}
export const formatTimeIL = (value) => value ? String(value).slice(0, 5) : "";
