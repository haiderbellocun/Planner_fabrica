// Cálculos puros de Capacidad Operativa (sin React) para poder probarlos.
//
// Dos lentes distintas, que NO deben mezclarse en una misma fila de indicadores:
//  - Carga del período: horas asignadas a las semanas del período elegido frente a la
//    capacidad de ESAS semanas (capacidad semanal × nº de semanas).
//  - Backlog total: todo lo pendiente, sin importar vencimiento, frente a UNA semana de
//    capacidad (misma lente que Capacidad de Fábrica). Se expresa en semanas equivalentes.
import type { CapacityForecastMember } from '@/hooks/useReports';

export type PeriodKey = 'current' | 'next' | 'next4';
export type Tone = 'available' | 'good' | 'warning' | 'critical';

export interface PeriodSnapshot {
  horas: number;
  capacidad: number;
  holgura: number;
  pct: number;
  /** % real (sin redondear): es el que clasifica la banda. */
  pctExact: number;
}

type MemberCapacity = Pick<CapacityForecastMember, 'weekly_hours_capacity' | 'current' | 'weeks'>;

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------------------------
// OCUPACIÓN SEMANAL — definición única para Reportes › Equipo, Capacidad y Capacidad Operativa:
//   ocupación (%) = horas comprometidas de la semana ÷ capacidad semanal del equipo × 100
//  · horas comprometidas = horas ESTIMADAS de tareas sin completar vencidas o con vencimiento esta
//    semana (carga_semana_actual del backend). Las tareas sin horas estimadas NO suman horas.
//  · población = personas activas con cargo (la que devuelve capacity-forecast).
//  · se calcula con precisión completa y solo se redondea al mostrarla (entero).
// Cualquier tarjeta de ocupación semanal debe salir de estas funciones; no se calcula por separado.
// ---------------------------------------------------------------------------------------------

/** Porcentaje con precisión completa (`exact`) y entero para mostrar (`pct`). Capacidad ≤ 0 → 0. */
export function occupancyPct(horas: number, capacidad: number): { exact: number; pct: number } {
  // horas × 100 ÷ capacidad (y no horas ÷ capacidad × 100): evita errores de coma flotante justo en los límites.
  const exact = capacidad > 0 ? (horas * 100) / capacidad : 0;
  return { exact, pct: Math.round(exact) };
}

type WeeklyMember = Pick<CapacityForecastMember, 'weekly_hours_capacity'> & {
  current: Pick<CapacityForecastMember['current'], 'carga_semana_actual'> &
    Partial<Pick<CapacityForecastMember['current'], 'carga_semana_actual_aprox' | 'unidades_semana_actual_sin_estimacion'>>;
};

export interface WeeklyOccupancy {
  horas: number;
  capacidad: number;
  holgura: number;
  /** Indicador oficial: solo horas realmente estimadas. */
  pctExact: number;
  pct: number;
  /** Tareas activas de la semana sin horas: la ocupación real podría ser mayor. */
  tareasSinEstimar: number;
  /** Estado de la ocupación semanal oficial (escala única, clasificada con el % real). */
  band: OccupancyBand;
  /** Estimación referencial (promedio de las tareas con horas). Nunca sustituye al indicador oficial. */
  estimacion: { horas: number; pctExact: number; pct: number } | null;
}

export function weeklyOccupancy(members: WeeklyMember[]): WeeklyOccupancy {
  let horas = 0, capacidad = 0, aprox = 0, sinEstimar = 0, hayAprox = false;
  for (const m of members) {
    horas += m.current.carga_semana_actual;
    capacidad += m.weekly_hours_capacity;
    sinEstimar += m.current.unidades_semana_actual_sin_estimacion ?? 0;
    if (m.current.carga_semana_actual_aprox != null) { aprox += m.current.carga_semana_actual_aprox; hayAprox = true; }
  }
  const oficial = occupancyPct(horas, capacidad);
  const est = occupancyPct(aprox, capacidad);
  return {
    horas: round2(horas),
    capacidad: round2(capacidad),
    holgura: round2(capacidad - horas),
    pctExact: oficial.exact,
    pct: oficial.pct,
    tareasSinEstimar: sinEstimar,
    band: occupancyBand(oficial.exact),
    estimacion: sinEstimar > 0 && hayAprox ? { horas: round2(aprox), pctExact: est.exact, pct: est.pct } : null,
  };
}

type BacklogMember = Pick<CapacityForecastMember, 'weekly_hours_capacity'> & {
  backlog: Pick<CapacityForecastMember['backlog'], 'horas_total'> & Partial<Pick<CapacityForecastMember['backlog'], 'unidades_sin_estimacion'>>;
};

export interface TotalOccupancy {
  /** Todo lo pendiente (sin importar el vencimiento) de la capacidad activa. */
  horasActivas: number;
  capacidadSemanal: number;
  pctExact: number;
  /** Con un decimal (puede superar 100 %: 200 % ≈ dos semanas de trabajo acumulado). */
  pct: number;
  /** Semanas de trabajo acumulado con la capacidad actual (un decimal). */
  semanas: number;
  /** Horas pendientes de personas inactivas, sin cargo o sin responsable: no entran en la capacidad activa. */
  fueraDeCapacidad: number;
  tareasSinEstimar: number;
}

/**
 * Ocupación total (antes «carga acumulada») = todo el trabajo pendiente de la población activa con cargo ÷ su capacidad de UNA semana.
 * `horasPendientesTotales` (opcional) es el total pendiente de la fábrica; la diferencia con las horas de la
 * población activa se conserva aparte como «fuera de la capacidad activa» (no desaparece de los reportes).
 */
export function totalOccupancy(members: BacklogMember[], horasPendientesTotales?: number): TotalOccupancy {
  let horas = 0, capacidad = 0, sinEstimar = 0;
  for (const m of members) {
    horas += m.backlog.horas_total;
    capacidad += m.weekly_hours_capacity;
    sinEstimar += m.backlog.unidades_sin_estimacion ?? 0;
  }
  const { exact } = occupancyPct(horas, capacidad);
  const fuera = horasPendientesTotales == null ? 0 : Math.max(0, horasPendientesTotales - horas);
  return {
    horasActivas: round2(horas),
    capacidadSemanal: round2(capacidad),
    pctExact: exact,
    pct: Math.round(exact * 10) / 10,
    semanas: capacidad > 0 ? Math.round((horas / capacidad) * 10) / 10 : 0,
    fueraDeCapacidad: fuera < 0.05 ? 0 : Math.round(fuera * 10) / 10,
    tareasSinEstimar: sinEstimar,
  };
}

/**
 * Tareas sin horas estimadas que NO están en la ocupación del período elegido y podrían aumentarla:
 * esta semana = las activas con vencimiento hasta fin de semana; próxima semana y próximas 4 semanas
 * = todas las pendientes sin horas (el reparto semanal solo usa horas estimadas).
 */
export function unestimatedTasksForPeriod(
  rows: (Pick<CapacityForecastMember, 'current' | 'backlog'>)[],
  period: PeriodKey,
): number {
  return rows.reduce(
    (s, r) => s + (period === 'current' ? r.current.unidades_semana_actual_sin_estimacion : r.backlog.unidades_sin_estimacion),
    0,
  );
}

// ---------------------------------------------------------------------------------------------
// BANDAS DE OCUPACIÓN SEMANAL — escala institucional única (se clasifica con el % real, sin redondear):
//   < 50 %            Baja carga       (capacidad disponible; no es subutilización por defecto)
//   50 % – 85 %       Disponible
//   > 85 % – 100 %    Alta ocupación
//   > 100 %           Sobrecarga
// Solo aplica a ocupación semanal/proyectada. La «Carga acumulada» y el riesgo de proyectos NO usan estas bandas.
// `tone` conecta con los tokens semánticos: available = info (azul suave), good = success (verde),
// warning = ámbar, critical = destructivo.
// ---------------------------------------------------------------------------------------------
export type OccupancyLevel = 'low' | 'available' | 'high' | 'over';

export const OCCUPANCY_THRESHOLDS = { AVAILABLE_FROM: 50, HIGH_ABOVE: 85, OVER_ABOVE: 100 } as const;

export interface OccupancyBand {
  level: OccupancyLevel;
  tone: Tone;
  label: string;
}

const OCCUPANCY_BANDS: Record<OccupancyLevel, OccupancyBand> = {
  low: { level: 'low', tone: 'available', label: 'Baja carga' },
  available: { level: 'available', tone: 'good', label: 'Disponible' },
  high: { level: 'high', tone: 'warning', label: 'Alta ocupación' },
  over: { level: 'over', tone: 'critical', label: 'Sobrecarga' },
};

export const OCCUPANCY_LEVELS: OccupancyLevel[] = ['low', 'available', 'high', 'over'];

export function occupancyLevel(pctExact: number): OccupancyLevel {
  if (pctExact > OCCUPANCY_THRESHOLDS.OVER_ABOVE) return 'over';
  if (pctExact > OCCUPANCY_THRESHOLDS.HIGH_ABOVE) return 'high';
  if (pctExact >= OCCUPANCY_THRESHOLDS.AVAILABLE_FROM) return 'available';
  return 'low';
}

/** Estado (nivel, etiqueta y tono) de una ocupación semanal. Recibe el % REAL, no el redondeado. */
export function occupancyBand(pctExact: number): OccupancyBand {
  return OCCUPANCY_BANDS[occupancyLevel(pctExact)];
}

export function occupancyBandByLevel(level: OccupancyLevel): OccupancyBand {
  return OCCUPANCY_BANDS[level];
}

/**
 * Texto del % para mostrarlo junto a su estado. Es entero, salvo cuando redondear lo pondría en otra banda
 * (p. ej. 100,4 % es Sobrecarga y no puede leerse «100 %»): entonces añade los decimales mínimos necesarios.
 */
export function formatOccupancyPct(pctExact: number): string {
  const level = occupancyLevel(pctExact);
  if (occupancyLevel(Math.round(pctExact)) === level) return `${Math.round(pctExact)}%`;
  for (let d = 1; d <= 3; d++) {
    const t = pctExact.toFixed(d);
    if (occupancyLevel(Number(t)) === level) return `${t}%`;
  }
  return `${pctExact.toFixed(3)}%`;
}

/** Ocupación semanal real de una persona (carga de la semana ÷ su capacidad semanal). */
export function memberWeeklyPctExact(m: WeeklyMember): number {
  return occupancyPct(m.current.carga_semana_actual, m.weekly_hours_capacity).exact;
}

export interface OccupancyCounts extends Record<OccupancyLevel, number> {
  /** Personas con capacidad semanal 0: no se pueden clasificar y no entran en ningún contador. */
  sinCapacidad: number;
}

/** Colaboradores por estado, a partir de su % real individual (no de los risk_counts del backend). */
export function occupancyCounts(members: WeeklyMember[]): OccupancyCounts {
  const counts: OccupancyCounts = { low: 0, available: 0, high: 0, over: 0, sinCapacidad: 0 };
  for (const m of members) {
    if (!(m.weekly_hours_capacity > 0)) { counts.sinCapacidad++; continue; }
    counts[occupancyLevel(memberWeeklyPctExact(m))]++;
  }
  return counts;
}

// Días hábiles que quedan en la semana laboral contando hoy: lun=5 … vie=1. Sábado y domingo = 0.
export function remainingBusinessDays(date: Date): number {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return 0;
  return 6 - dow;
}

export function remainingWeekCapacity(weeklyCapacity: number, date: Date = new Date()): number {
  return round2((weeklyCapacity / 5) * remainingBusinessDays(date));
}

// Capacidad contra la que se mide la semana actual en la curva de tendencia: lo que queda
// de la semana. Si ya no queda ningún día hábil (fin de semana) se usa la capacidad semanal
// completa; con capacidad 0 la ocupación saldría 0 % aunque haya carga pendiente.
export function currentWeekCapacityForTrend(totalWeekly: number, date: Date = new Date()): number {
  const remaining = remainingWeekCapacity(totalWeekly, date);
  return remaining > 0 ? remaining : totalWeekly;
}

export function periodSnapshot(member: MemberCapacity, period: PeriodKey): PeriodSnapshot {
  const capacidadSemana = member.weekly_hours_capacity;
  if (period === 'current') {
    return {
      horas: member.current.carga_semana_actual,
      capacidad: capacidadSemana,
      holgura: member.current.holgura_horas,
      pct: member.current.utilizacion_pct,
      pctExact: occupancyPct(member.current.carga_semana_actual, capacidadSemana).exact,
    };
  }
  if (period === 'next') {
    // weeks[0] es siempre la semana actual (es_semana_actual): "próxima" es la primera después.
    const w = member.weeks.find((w) => !w.es_semana_actual) ?? member.weeks[1];
    if (!w) return { horas: 0, capacidad: capacidadSemana, holgura: capacidadSemana, pct: 0, pctExact: 0 };
    return {
      horas: w.horas, capacidad: capacidadSemana, holgura: w.holgura_horas, pct: w.utilizacion_pct,
      pctExact: occupancyPct(w.horas, capacidadSemana).exact,
    };
  }
  // 'next4' = toda la ventana del pronóstico (semana actual + siguientes).
  const ws = member.weeks;
  const horas = ws.reduce((s, w) => s + w.horas, 0);
  const capacidad = capacidadSemana * (ws.length || 1);
  const { exact, pct } = occupancyPct(horas, capacidad);
  return { horas, capacidad, holgura: round2(capacidad - horas), pct, pctExact: exact };
}

export interface PeriodKpis {
  capacidad: number;
  comprometidas: number;
  disponible: number;
  ocupacion: number;
  /** % real de la ocupación del equipo (clasifica la banda). */
  ocupacionExact: number;
  sobrecargadas: number;
}

// Todos los indicadores salen del MISMO snapshot por persona, así comparten período.
export function aggregatePeriodKpis(rows: MemberCapacity[], period: PeriodKey): PeriodKpis {
  let capacidad = 0, comprometidas = 0, sobrecargadas = 0;
  for (const r of rows) {
    const snap = periodSnapshot(r, period);
    capacidad += snap.capacidad;
    comprometidas += snap.horas;
    if (occupancyLevel(snap.pctExact) === 'over') sobrecargadas++;
  }
  return {
    capacidad: round2(capacidad),
    comprometidas: round2(comprometidas),
    disponible: round2(capacidad - comprometidas),
    ocupacion: occupancyPct(comprometidas, capacidad).pct,
    ocupacionExact: occupancyPct(comprometidas, capacidad).exact,
    sobrecargadas,
  };
}

// Capacidad de UNA semana del equipo en el alcance, independiente del período elegido.
export function weeklyTeamCapacity(rows: Pick<CapacityForecastMember, 'weekly_hours_capacity'>[]): number {
  return round2(rows.reduce((s, r) => s + r.weekly_hours_capacity, 0));
}

export interface BacklogHeadroom {
  capacidadSemanal: number;
  backlogTotal: number;
  semanasEquivalentes: number;
  ocupacionBacklogPct: number;
  tone: Tone;
  verdict: string;
}

export function backlogHeadroom(capacidadSemanal: number, backlogTotal: number): BacklogHeadroom {
  const semanasEquivalentes = capacidadSemanal > 0 ? Math.round((backlogTotal / capacidadSemanal) * 10) / 10 : 0;
  const ocupacionBacklogPct = capacidadSemanal > 0 ? Math.round((backlogTotal / capacidadSemanal) * 100) : 0;
  let tone: Tone;
  let verdict: string;
  if (capacidadSemanal === 0) {
    tone = 'warning';
    verdict = 'Sin datos de capacidad en este alcance';
  } else if (semanasEquivalentes <= 1) {
    tone = 'good';
    verdict = 'Hay espacio para más proyectos';
  } else if (semanasEquivalentes <= 2) {
    tone = 'warning';
    verdict = 'Espacio limitado';
  } else {
    tone = 'critical';
    verdict = 'Sin espacio — equipo saturado';
  }
  return { capacidadSemanal, backlogTotal, semanasEquivalentes, ocupacionBacklogPct, tone, verdict };
}

// Etiqueta de una semana del pronóstico según su posición respecto de la semana actual.
export function forecastWeekLabel(week: { es_semana_actual: boolean }, index: number): string {
  if (week.es_semana_actual) return 'Esta semana';
  return index === 1 ? 'Próxima semana' : `Semana +${index}`;
}
