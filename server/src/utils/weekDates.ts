// Pure UTC calendar-day arithmetic — deliberately not using local Date methods,
// so "which Monday does this date belong to" is identical regardless of the
// server host's timezone.

export function normalizeToMonday(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const day = dt.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // offset to Monday
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

export function todayMonday(): string {
  return normalizeToMonday(new Date().toISOString().slice(0, 10));
}
