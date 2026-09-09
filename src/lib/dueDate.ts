// Regla de vencimiento compartida — una sola fuente de verdad para "vencida"/"vence hoy"/"próxima".
// Se compara por string yyyy-MM-dd (no por objetos Date) para no depender de la hora del navegador
// ni introducir desfases de UTC (ver .toISOString() en usos previos, que puede adelantar el día).

export const BUSINESS_TIMEZONE = 'America/Bogota';

const businessDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIMEZONE });

/** "Hoy" (yyyy-MM-dd) en la zona horaria de negocio, sin importar la zona del navegador. */
export function getBusinessTodayStr(now: Date = new Date()): string {
  return businessDateFormatter.format(now);
}

export type DueBucket = 'overdue' | 'due_today' | 'upcoming' | 'none';

/**
 * Clasifica una fecha límite (string yyyy-MM-dd, con o sin hora) contra "hoy".
 * - Sin fecha → 'none'.
 * - Tarea finalizada → 'none' siempre (una tarea completada no se marca como vencida ni por vencer).
 * - Anterior a hoy → 'overdue'. Igual a hoy → 'due_today'. Posterior → 'upcoming'.
 */
export function getDueBucket(
  dueDate: string | null | undefined,
  isCompleted: boolean,
  todayStr: string = getBusinessTodayStr(),
): DueBucket {
  if (!dueDate) return 'none';
  if (isCompleted) return 'none';

  const d = dueDate.slice(0, 10);
  if (d < todayStr) return 'overdue';
  if (d === todayStr) return 'due_today';
  return 'upcoming';
}

/** true si la fecha es estrictamente posterior a hoy y cae dentro de los próximos `days` días (inclusive). */
export function isWithinDays(
  dueDate: string | null | undefined,
  days: number,
  todayStr: string = getBusinessTodayStr(),
): boolean {
  if (!dueDate) return false;
  const d = dueDate.slice(0, 10);
  if (d <= todayStr) return false;

  // Aritmética en fecha local (sin pasar por .toISOString(), que convierte a UTC y puede
  // desplazar el día según la zona del navegador) — se parsean y reconstruyen los componentes
  // yyyy-MM-dd manualmente en vez de usar getters UTC o locales mezclados.
  const [ty, tm, td] = todayStr.split('-').map((n) => parseInt(n, 10));
  const limit = new Date(ty, tm - 1, td);
  limit.setDate(limit.getDate() + days);
  const limitStr = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, '0')}-${String(limit.getDate()).padStart(2, '0')}`;
  return d <= limitStr;
}
