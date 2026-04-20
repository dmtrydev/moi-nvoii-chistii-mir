/** PG bigint / JSON иногда приходят строкой — для URL и сопоставления с маркерами нужен единый number. */
export function toPositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const t = value.trim();
    if (/^\d+$/.test(t)) {
      const n = Number(t);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}
