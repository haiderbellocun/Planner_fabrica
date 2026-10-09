import { describe, it, expect } from 'vitest';
import {
  aggregatePeriodKpis, backlogHeadroom, currentWeekCapacityForTrend, forecastWeekLabel,
  periodSnapshot, remainingBusinessDays, remainingWeekCapacity, weeklyTeamCapacity,
} from './capacityMetrics';

const week = (n: number, horas: number, cap: number) => ({
  week_start: `2026-10-${String(5 + n * 7).padStart(2, '0')}`,
  es_semana_actual: n === 0,
  horas,
  utilizacion_pct: cap > 0 ? Math.round((horas / cap) * 100) : 0,
  holgura_horas: cap - horas,
});

// Persona con `cap` h/semana; `current` incluye lo vencido y `weeks` es la carga repartida.
const member = (cap: number, current: number, weeks: number[]) => ({
  weekly_hours_capacity: cap,
  current: {
    carga_semana_actual: current,
    utilizacion_pct: Math.round((current / cap) * 100),
    holgura_horas: cap - current,
  },
  weeks: weeks.map((h, i) => week(i, h, cap)),
}) as unknown as Parameters<typeof periodSnapshot>[0];

describe('periodSnapshot', () => {
  const m = member(40, 50, [30, 20, 10, 0]);
  it('current usa la carga de la semana actual y la capacidad de una semana', () => {
    expect(periodSnapshot(m, 'current')).toMatchObject({ horas: 50, capacidad: 40, holgura: -10, pct: 125 });
  });
  it('next toma la primera semana posterior a la actual', () => {
    expect(periodSnapshot(m, 'next')).toMatchObject({ horas: 20, capacidad: 40, pct: 50 });
  });
  it('next4 suma la ventana completa contra capacidad × nº de semanas', () => {
    expect(periodSnapshot(m, 'next4')).toEqual({ horas: 60, capacidad: 160, holgura: 100, pct: 38 });
  });
  it('next sin semanas siguientes devuelve holgura completa', () => {
    expect(periodSnapshot(member(40, 0, [0]), 'next')).toMatchObject({ horas: 0, pct: 0, holgura: 40 });
  });
});

describe('aggregatePeriodKpis', () => {
  const rows = [member(40, 50, [30, 20, 10, 0]), member(40, 10, [10, 5, 5, 5])];
  it('current: capacidad 80, carga 60, disponible 20, 1 sobrecargada', () => {
    expect(aggregatePeriodKpis(rows, 'current')).toEqual({
      capacidad: 80, comprometidas: 60, disponible: 20, ocupacion: 75, sobrecargadas: 1,
    });
  });
  it('next4: capacidad y carga abarcan las 4 semanas y los indicadores cuadran entre sí', () => {
    const k = aggregatePeriodKpis(rows, 'next4');
    expect(k.capacidad).toBe(320);
    expect(k.comprometidas).toBe(85);
    expect(k.disponible).toBe(k.capacidad - k.comprometidas);
    expect(k.ocupacion).toBe(Math.round((85 / 320) * 100));
    expect(k.sobrecargadas).toBe(0);
  });
  it('sin filas no divide por cero', () => {
    expect(aggregatePeriodKpis([], 'current')).toMatchObject({ capacidad: 0, ocupacion: 0, sobrecargadas: 0 });
  });
});

describe('backlog frente a período', () => {
  const rows = [member(40, 0, [0, 0, 0, 0]), member(40, 0, [0, 0, 0, 0])];
  it('la capacidad para el backlog es una semana aunque el período sea de 4', () => {
    expect(aggregatePeriodKpis(rows, 'next4').capacidad).toBe(320);
    expect(weeklyTeamCapacity(rows)).toBe(80);
  });
  it('120h de backlog sobre 80h/semana son 1,5 semanas (no 0,4 como con la capacidad de 4 semanas)', () => {
    const h = backlogHeadroom(weeklyTeamCapacity(rows), 120);
    expect(h.semanasEquivalentes).toBe(1.5);
    expect(h.ocupacionBacklogPct).toBe(150);
    expect(h.tone).toBe('warning');
  });
  it('veredictos en los umbrales de 1 y 2 semanas', () => {
    expect(backlogHeadroom(80, 80).tone).toBe('good');
    expect(backlogHeadroom(80, 160).tone).toBe('warning');
    expect(backlogHeadroom(80, 170).tone).toBe('critical');
    expect(backlogHeadroom(0, 50).verdict).toMatch(/Sin datos/);
  });
});

describe('capacidad restante de la semana actual', () => {
  const mon = new Date('2026-10-05T10:00:00');
  const fri = new Date('2026-10-09T10:00:00');
  const sat = new Date('2026-10-10T10:00:00');
  const sun = new Date('2026-10-11T10:00:00');
  it('días hábiles restantes', () => {
    expect([mon, fri, sat, sun].map(remainingBusinessDays)).toEqual([5, 1, 0, 0]);
  });
  it('capacidad restante proporcional', () => {
    expect(remainingWeekCapacity(40, fri)).toBe(8);
  });
  it('en fin de semana la tendencia usa la capacidad semanal completa en vez de 0 %', () => {
    expect(currentWeekCapacityForTrend(80, sat)).toBe(80);
    expect(currentWeekCapacityForTrend(80, sun)).toBe(80);
    expect(currentWeekCapacityForTrend(80, fri)).toBe(16);
  });
});

describe('forecastWeekLabel', () => {
  const ws = [0, 1, 2, 3].map((i) => ({ es_semana_actual: i === 0 }));
  it('etiqueta según es_semana_actual y posición', () => {
    expect(ws.map((w, i) => forecastWeekLabel(w, i))).toEqual(['Esta semana', 'Próxima semana', 'Semana +2', 'Semana +3']);
  });
});
