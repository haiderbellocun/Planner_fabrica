export function parseDateOnly(date: string | null | undefined): Date | null {
  if (!date) return null;
  try {
    const datePart = date.slice(0, 10); // yyyy-MM-dd
    const [y, m, d] = datePart.split('-').map((n) => parseInt(n, 10));
    if (!y || !m || !d) return null;
    // Crear fecha local sin desfase de zona horaria
    return new Date(y, m - 1, d);
  } catch {
    return null;
  }
}


/** yyyy-MM-dd con los componentes LOCALES de la fecha (toISOString() usa UTC y corre el día). */
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Lunes (00:00 local) de la semana que contiene `d`. Domingo pertenece a la semana que termina. */
export function startOfWorkWeek(d: Date): Date {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

/** Domingo (00:00 local) de la semana que contiene `d`; la semana va de lunes a domingo. */
export function endOfWorkWeek(d: Date): Date {
  const sunday = startOfWorkWeek(d);
  sunday.setDate(sunday.getDate() + 6);
  return sunday;
}

export type DatePeriod = 'hoy' | 'semana' | 'mes' | 'sprint' | 'personalizado' | 'todo';

/** Rango date_from/date_to (yyyy-MM-dd, fechas locales) de un periodo; {} si no aplica. */
export function resolvePeriodRangeFor(
  period: DatePeriod,
  custom: { from?: string; to?: string } = {},
  today: Date = new Date(),
): { date_from?: string; date_to?: string } {
  if (period === 'hoy') return { date_from: toLocalISODate(today), date_to: toLocalISODate(today) };
  if (period === 'semana') {
    return { date_from: toLocalISODate(startOfWorkWeek(today)), date_to: toLocalISODate(endOfWorkWeek(today)) };
  }
  if (period === 'mes') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { date_from: toLocalISODate(first), date_to: toLocalISODate(last) };
  }
  if (period === 'personalizado' && custom.from && custom.to) return { date_from: custom.from, date_to: custom.to };
  return {};
}

/** Últimos `days` días hasta hoy (fechas locales, yyyy-MM-dd). */
export function rollingDateRange(days: number, now: Date = new Date()): { date_from: string; date_to: string } {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return { date_from: toLocalISODate(from), date_to: toLocalISODate(now) };
}
