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
}

type MemberCapacity = Pick<CapacityForecastMember, 'weekly_hours_capacity' | 'current' | 'weeks'>;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function operativeBand(pct: number): { tone: Tone; label: string } {
  if (pct > 100) return { tone: 'critical', label: 'Sobrecarga' };
  if (pct >= 86) return { tone: 'warning', label: 'Alta ocupación' };
  if (pct >= 61) return { tone: 'good', label: 'Saludable' };
  return { tone: 'available', label: 'Disponible' };
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
    };
  }
  if (period === 'next') {
    // weeks[0] es siempre la semana actual (es_semana_actual): "próxima" es la primera después.
    const w = member.weeks.find((w) => !w.es_semana_actual) ?? member.weeks[1];
    if (!w) return { horas: 0, capacidad: capacidadSemana, holgura: capacidadSemana, pct: 0 };
    return { horas: w.horas, capacidad: capacidadSemana, holgura: w.holgura_horas, pct: w.utilizacion_pct };
  }
  // 'next4' = toda la ventana del pronóstico (semana actual + siguientes).
  const ws = member.weeks;
  const horas = ws.reduce((s, w) => s + w.horas, 0);
  const capacidad = capacidadSemana * (ws.length || 1);
  const pct = capacidad > 0 ? Math.round((horas / capacidad) * 100) : 0;
  return { horas, capacidad, holgura: round2(capacidad - horas), pct };
}

export interface PeriodKpis {
  capacidad: number;
  comprometidas: number;
  disponible: number;
  ocupacion: number;
  sobrecargadas: number;
}

// Todos los indicadores salen del MISMO snapshot por persona, así comparten período.
export function aggregatePeriodKpis(rows: MemberCapacity[], period: PeriodKey): PeriodKpis {
  let capacidad = 0, comprometidas = 0, sobrecargadas = 0;
  for (const r of rows) {
    const snap = periodSnapshot(r, period);
    capacidad += snap.capacidad;
    comprometidas += snap.horas;
    if (operativeBand(snap.pct).tone === 'critical') sobrecargadas++;
  }
  return {
    capacidad: round2(capacidad),
    comprometidas: round2(comprometidas),
    disponible: round2(capacidad - comprometidas),
    ocupacion: capacidad > 0 ? Math.round((comprometidas / capacidad) * 100) : 0,
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
