import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  totalOccupancy, aggregatePeriodKpis, occupancyPct, unestimatedTasksForPeriod, weeklyOccupancy,
  occupancyBand, occupancyLevel, occupancyCounts, formatOccupancyPct, periodSnapshot, OCCUPANCY_LEVELS, type OccupancyLevel,
} from '@/lib/capacityMetrics';

// Ocupación semanal: UNA definición para Reportes › Equipo, Capacidad y Capacidad Operativa.
//   % = horas comprometidas de la semana ÷ capacidad semanal del equipo × 100  (solo horas estimadas)

type M = ReturnType<typeof member>;
const week = (n: number, horas: number, cap: number) => ({
  week_start: `2026-10-${String(5 + n * 7).padStart(2, '0')}`, es_semana_actual: n === 0, horas,
  utilizacion_pct: cap > 0 ? Math.round((horas / cap) * 100) : 0, holgura_horas: cap - horas, risk_level: 'ok' as const, risk_label: 'OK', risk_color: 'emerald' as const,
});
const member = (id: string, name: string, cap: number, carga: number, weeks: number[], opts: { sinEstimar?: number; aprox?: number; backlog?: number; sinEstBacklog?: number } = {}) => ({
  id, full_name: name, cargo: 'Diseño', avatar_url: null, weekly_hours_capacity: cap,
  current: {
    horas_vencidas: 0, horas_semana_actual: carga, carga_semana_actual: carga,
    utilizacion_pct: cap > 0 ? Math.round((carga / cap) * 100) : 0, holgura_horas: cap - carga,
    risk_level: 'ok' as const, risk_label: 'OK', risk_color: 'emerald' as const,
    unidades_semana_actual_sin_estimacion: opts.sinEstimar ?? 0, carga_semana_actual_aprox: opts.aprox ?? carga,
    utilizacion_aprox_pct: 0, holgura_aprox_horas: 0,
  },
  weeks: weeks.map((h, i) => week(i, h, cap)),
  backlog: { horas_total: opts.backlog ?? carga, horas_sin_fecha: 0, unidades_sin_estimacion: opts.sinEstBacklog ?? 0, dias_para_vaciar: 5, fecha_backlog_vacio: null },
});

const data = { members: [] as M[], pendingTotal: 0, forecastCalls: [] as unknown[] };
vi.mock('@/hooks/useReports', () => {
  const names = ['useReportOverview', 'useReportProjectsProgress', 'useReportTeamPerformance', 'useReportTimeDistribution', 'useReportWorkflowTransitions',
    'useReportWorkloadByCargo', 'useReportTeamCapacity', 'useUserMiniReport', 'useReportProjectCategories', 'useReportTasksWeeklyTrend', 'useReportProjectsTimeline',
    'useReportTeamMonthlyCompletion', 'useReportTeamByCargo', 'useReportWeeklyByCargo', 'useReportUnassignedMaterials', 'useReportTimeByPhase', 'useReportTasksDetail',
    'useReportIndividualPerformance', 'useReportOntimeByEquipo', 'useReportThroughput', 'useReportContentOverview', 'useReportUserLocations',
    'useReportProjectUtilizationDetail'];
  const q = (d: unknown) => ({ data: d, isLoading: false, isError: false, error: null, isFetching: false, isPlaceholderData: false, refetch: () => undefined });
  const out: Record<string, unknown> = Object.fromEntries(names.map((n) => [n, () => q(undefined)]));
  out.useReportCapacityForecast = (filters: { cargo?: string } = {}) => {
    data.forecastCalls.push(filters);
    return q({
      schedule: {},
      members: data.members.filter((m) => !filters.cargo || m.cargo === filters.cargo),
      overall: { risk_counts: { available: 0, ok: 0, warning: 0, over: 0 }, avg_horas_asumidas: 6, unidades_semana_actual_sin_estimacion: 0 },
    });
  };
  out.useReportPeopleWorkload = () => q({ people: [] });
  out.useReportWorkloadByCargo = () => q([]);
  out.useReportThroughput = () => q([]);
  out.useReportPersonMetrics = () => q({ people: [{ id: 'p1', full_name: 'Ana', cargo: 'Diseño', avatar_url: null, unidades_asignadas: 1, unidades_completadas: 0, unidades_pendientes: 1, unidades_vencidas: 0, horas_pendientes: 1, horas_completadas: 0, puntualidad_pct: null, entregas_evaluables: 0, entregas_a_tiempo: 0 }], overall: { puntualidad_pct: null } });
  out.useReportProjectUtilization = () => q({
    projects: [],
    summary: { horas_pendientes_fabrica: data.pendingTotal, personas_con_pendientes: 3, n_personas_fabrica: data.members.length, capacidad_semanal_ocupada: 0, capacidad_semanal_fabrica: 0, utilizacion_pct_equipo_ocupado: 0, utilizacion_pct_fabrica: 0 },
  });
  out.useReportProductionCapacity = () => q({ direct: { pct_of_total: 0, capacidad_semanal: 0, n_personas: 0, by_cargo: [] }, indirect: { pct_of_total: 0, capacidad_semanal: 0, n_personas: 0, by_cargo: [] } });
  return out;
});
vi.mock('@/hooks/useProjects', () => ({ useProjects: () => ({ data: [] }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAdmin: true, isProjectLeader: false, user: { id: 'u1', role: 'admin' } }) }));

import { CapacidadOperativaTab } from '@/components/reports/CapacidadOperativaTab';
import { CapacidadFabricaTab } from '@/components/reports/CapacidadFabricaTab';
import ReportsPage from '@/pages/Reports';

beforeAll(() => {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
});
beforeEach(() => { cleanup(); });

// --- lectura de cada tarjeta ---------------------------------------------------------------------
const BAND_LABELS = ['Baja carga', 'Disponible', 'Alta ocupación', 'Sobrecarga'];
const bandIn = (text: string) => BAND_LABELS.filter((l) => text.includes(l));

const operativaTile = () => {
  render(<TooltipProvider><CapacidadOperativaTab /></TooltipProvider>);
  return Array.from(document.querySelectorAll<HTMLElement>('.stat-tile')).find((t) => /^Ocupación/.test(t.textContent ?? ''))!;
};
const operativa = () => operativaTile().querySelector('.stat-tile-value')!.textContent!;
const fabricaCard = () => {
  render(<TooltipProvider><CapacidadFabricaTab /></TooltipProvider>);
  return screen.getByTestId('ocupacion-total');
};
// Capacidad (Fábrica) ya NO muestra la ocupación semanal: solo la «Ocupación total».
const sinOcupacionSemanal = () => {
  expect(screen.queryByTestId('ocupacion-semanal')).toBeNull();
  expect(screen.queryByTestId('ocupacion-estado')).toBeNull();
  expect(screen.queryByText('Ocupación semanal')).toBeNull();
};
const equipoPage = async () => {
  render(<TooltipProvider><ReportsPage /></TooltipProvider>);
  fireEvent.mouseDown(screen.getByRole('tab', { name: /^Equipo/ }), { button: 0, ctrlKey: false });
  return (await screen.findAllByText(/de ocupación semanal/, {}, { timeout: 10000 }))[0];
};
const equipo = async () => {
  const hero = await equipoPage();
  return `${hero.textContent!.match(/(\d+)% de ocupación semanal/)![1]}%`;
};

const scenario = () => {
  // 100 h de capacidad; 85,5 h comprometidas (parciales) → 85,5 % → se muestra 86 % (redondeo a entero)
  data.members = [
    member('1', 'Ana', 40, 30.5, [30.5, 10, 5, 5], { backlog: 120 }),
    member('2', 'Luis', 40, 50, [50, 20, 10, 0], { backlog: 90 }),   // 125 % individual: sobrecarga
    member('3', 'Eva', 20, 5, [5, 0, 0, 0], { backlog: 5 }),
    member('4', 'Sin tareas', 0, 0, [0, 0, 0, 0], { backlog: 0 }),    // capacidad 0 y sin tareas
  ];
  data.pendingTotal = 215 + 60; // 60 h fuera de la capacidad activa (inactivos / sin cargo / sin responsable)
};

describe('misma ocupación semanal en las tres pestañas', () => {
  it('mismo período, mismos colaboradores y mismas tareas → el mismo porcentaje entero', async () => {
    scenario();
    const esperado = `${occupancyPct(30.5 + 50 + 5, 100).pct}%`;
    expect(esperado).toBe('86%');
    const a = await equipo();
    cleanup();
    const b = operativa();
    cleanup();
    expect([a, b]).toEqual([esperado, esperado]);
    cleanup();
    fabricaCard();
    sinOcupacionSemanal();
  }, 40000);

  it('una actualización de datos se refleja igual en las tres', async () => {
    scenario();
    data.members[0] = member('1', 'Ana', 40, 40, [40, 10, 5, 5], { backlog: 120 }); // sube a 95 % del total: 95/100
    const esperado = `${occupancyPct(40 + 50 + 5, 100).pct}%`;
    expect(esperado).toBe('95%');
    expect(await equipo()).toBe(esperado);
    cleanup();
    expect(operativa()).toBe(esperado);
  }, 40000);

  it('capacidad total cero → 0 % en las tres (sin NaN ni Infinity)', async () => {
    data.members = [member('1', 'Sin capacidad', 0, 12, [12, 0, 0, 0])];
    data.pendingTotal = 12;
    // con capacidad 0 las vistas muestran un estado vacío o 0 %; nunca valores no finitos
    expect(occupancyPct(12, 0)).toEqual({ exact: 0, pct: 0 });
    const op = operativa();
    expect(op).toBe('0%');
    cleanup();
    render(<TooltipProvider><CapacidadFabricaTab /></TooltipProvider>);
    expect(document.body.textContent).not.toMatch(/NaN|Infinity|undefined/);
  }, 40000);
});

describe('funciones compartidas: períodos, filtros y precisión', () => {
  const ms = () => [member('1', 'Ana', 40, 30, [30, 20, 10, 0]), member('2', 'Luis', 40, 50, [50, 10, 10, 10]), member('3', 'Eva', 20, 0, [0, 0, 0, 0])];
  it('semana actual / próxima semana / próximas 4: cada período usa su propia carga y capacidad', () => {
    const r = ms() as never[];
    expect(aggregatePeriodKpis(r, 'current').ocupacion).toBe(80);   // 80/100
    expect(aggregatePeriodKpis(r, 'next').ocupacion).toBe(30);      // 30/100
    expect(aggregatePeriodKpis(r, 'next4').ocupacion).toBe(Math.round((140 / 400) * 100)); // 35
  });
  it('la ocupación semanal oficial = la ocupación de Operativa en «Esta semana»', () => {
    const r = ms();
    expect(weeklyOccupancy(r).pct).toBe(aggregatePeriodKpis(r as never[], 'current').ocupacion);
  });
  it('un filtro (otra población) cambia el resultado y sigue siendo la misma función', () => {
    const all = ms();
    expect(weeklyOccupancy(all).pct).toBe(80);
    expect(weeklyOccupancy(all.slice(0, 1)).pct).toBe(75);   // solo Ana: 30/40
    expect(weeklyOccupancy(all.slice(1, 2)).pct).toBe(125);  // solo Luis: sobrecarga > 100 %
    expect(weeklyOccupancy([]).pct).toBe(0);
  });
  it('precisión completa interna, entero al mostrar, y .5 redondea hacia arriba', () => {
    const w = weeklyOccupancy([member('1', 'A', 30, 12.5, [12.5]), member('2', 'B', 10, 2.5, [2.5])]);
    expect(w.pctExact).toBeCloseTo(37.5, 10); // 15 / 40
    expect(w.pct).toBe(38);
    expect(weeklyOccupancy([member('1', 'A', 3, 1, [1])]).pctExact).toBeCloseTo(33.3333333, 5);
  });
});

describe('tareas sin horas estimadas', () => {
  it('no inflan la ocupación oficial: el promedio solo aparece como estimación aparte', () => {
    const miembros = [member('1', 'Ana', 40, 20, [20], { sinEstimar: 3, aprox: 38 }), member('2', 'Luis', 40, 20, [20], { sinEstimar: 0, aprox: 20 })];
    const w = weeklyOccupancy(miembros);
    expect(w.pct).toBe(50);                      // 40/80, solo horas estimadas
    expect(w.tareasSinEstimar).toBe(3);
    expect(w.estimacion).toEqual({ horas: 58, pctExact: 72.5, pct: 73 });
    expect(weeklyOccupancy([member('1', 'Ana', 40, 20, [20])]).estimacion).toBeNull();
  });
  it('el contador por período: esta semana usa las activas de la semana; los demás, todo lo pendiente sin horas', () => {
    const r = [member('1', 'Ana', 40, 20, [20, 5], { sinEstimar: 2, sinEstBacklog: 7 })] as never[];
    expect(unestimatedTasksForPeriod(r, 'current')).toBe(2);
    expect(unestimatedTasksForPeriod(r, 'next')).toBe(7);
    expect(unestimatedTasksForPeriod(r, 'next4')).toBe(7);
  });
  it('las tres pestañas avisan que la ocupación podría ser mayor (y el % oficial no cambia)', async () => {
    data.members = [member('1', 'Ana', 40, 20, [20, 0, 0, 0], { sinEstimar: 3, aprox: 38, backlog: 20, sinEstBacklog: 3 }), member('2', 'Luis', 40, 20, [20, 0, 0, 0], { backlog: 20 })];
    data.pendingTotal = 40;
    expect(await equipo()).toBe('50%');
    expect(screen.getByText(/podría ser mayor/)).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/Esta cifra es solo una estimación/);
    cleanup();
    expect(operativa()).toBe('50%');
    expect(screen.getByTestId('ocupacion-sin-estimar')).toHaveTextContent('3 tareas sin horas estimadas no cuentan');
    cleanup();
    fabricaCard();
    sinOcupacionSemanal();
    expect(screen.getByTestId('ocupacion-total-sin-estimar')).toHaveTextContent('3 tareas');
  }, 40000);
});

describe('carga acumulada: indicador independiente', () => {
  it('= todo lo pendiente de la población activa ÷ capacidad de UNA semana, con semanas de trabajo', () => {
    const r = [member('1', 'Ana', 40, 10, [10], { backlog: 100 }), member('2', 'Luis', 40, 10, [10], { backlog: 60 })];
    const a = totalOccupancy(r);
    expect(a.horasActivas).toBe(160);
    expect(a.capacidadSemanal).toBe(80);
    expect(a.pct).toBe(200);
    expect(a.semanas).toBe(2);
    expect(weeklyOccupancy(r).pct).toBe(25);      // la ocupación semanal NO es la carga acumulada
    expect(a.pct).not.toBe(weeklyOccupancy(r).pct);
  });
  it('conserva un decimal (y puede superar 100 %)', () => {
    const a = totalOccupancy([member('1', 'A', 40, 0, [0], { backlog: 38.24 })]);
    expect(a.pct).toBe(95.6);
    expect(a.semanas).toBe(1);
  });
  it('las horas de personas inactivas, sin cargo o sin responsable no desaparecen: se informan aparte', () => {
    const r = [member('1', 'Ana', 40, 0, [0], { backlog: 100 })];
    expect(totalOccupancy(r, 130).fueraDeCapacidad).toBe(30);
    expect(totalOccupancy(r, 100).fueraDeCapacidad).toBe(0);
    expect(totalOccupancy(r, 99.98).fueraDeCapacidad).toBe(0); // diferencias por redondeo no generan ruido
    expect(totalOccupancy(r, 130).horasActivas).toBe(100);     // no se mezclan con la población activa
  });
  it('Capacidad muestra la «Ocupación total» con %, semanas y las horas fuera de la capacidad activa; la ocupación semanal va aparte', () => {
    scenario();
    render(<TooltipProvider><CapacidadFabricaTab /></TooltipProvider>);
    const card = screen.getByTestId('ocupacion-total');
    expect(card).toHaveTextContent('Ocupación total');
    expect(screen.getByTestId('ocupacion-total-pct')).toHaveTextContent('215%'); // 215 h ÷ 100 h
    expect(screen.getByTestId('ocupacion-total-semanas')).toHaveTextContent('≈ 2.2 semanas');
    expect(screen.getByTestId('horas-fuera-capacidad')).toHaveTextContent('60h');
    sinOcupacionSemanal();
  });
  it('sin horas fuera de la capacidad activa no se muestra el aviso', () => {
    scenario();
    data.pendingTotal = 215;
    render(<TooltipProvider><CapacidadFabricaTab /></TooltipProvider>);
    expect(screen.queryByTestId('horas-fuera-capacidad')).not.toBeInTheDocument();
  });
});

describe('regresión: ninguna pestaña calcula la ocupación con una fórmula propia', () => {
  const read = (p: string) => readFileSync(p, 'utf8');
  const files = {
    equipo: read('src/pages/Reports.tsx'),
    fabrica: read('src/components/reports/CapacidadFabricaTab.tsx'),
    operativa: read('src/components/reports/CapacidadOperativaTab.tsx'),
  };
  it('las tres importan sus cálculos de lib/capacityMetrics', () => {
    expect(files.equipo).toContain("from '@/lib/capacityMetrics'");
    expect(files.fabrica).toContain("from '@/lib/capacityMetrics'");
    expect(files.operativa).toContain("from '@/lib/capacityMetrics'");
    expect(files.equipo).toMatch(/weeklyOccupancy\(capacityMembers\)/);
    expect(files.fabrica).not.toMatch(/weeklyOccupancy|WeeklyOccupancyCard/); // Capacidad solo muestra la ocupación total
    expect(files.operativa).toMatch(/aggregatePeriodKpis\(tableRows, periodKey\)/);
  });
  it('no usan los porcentajes precalculados por el servidor para el indicador (utilizacion_pct del overall, aproximado ni de fábrica)', () => {
    for (const [name, src] of Object.entries(files)) {
      expect(src, name).not.toMatch(/overall\.utilizacion_pct|overall\.utilizacion_aprox_pct|summary\.utilizacion_pct_fabrica|utilizacion_pct_equipo_ocupado/);
    }
  });
  it('no recalculan un porcentaje de ocupación con una división propia (carga/capacidad × 100) fuera del módulo compartido', () => {
    const independiente = /(carga|horas|comprometid\w*|pendientes)\w*\s*\/\s*(capacidad\w*|cap)\s*\)?\s*\*\s*100/i;
    for (const [name, src] of Object.entries(files)) {
      // Se excluyen las ocupaciones POR PERSONA/PROYECTO/CARGO y las curvas de tendencia, que no son la tarjeta de equipo.
      const lines = src.split('\n').filter((l) => independiente.test(l) && !/trend|persona|row|member|project|cargo|c\.|e\.asignadas|week|semana|w\./i.test(l));
      expect(lines, name).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Bandas de ocupación semanal (escala institucional única 50 / 85 / 100, con el % real sin redondear)
// ---------------------------------------------------------------------------------------------
describe('bandas de ocupación: límites', () => {
  const cases: [number, OccupancyLevel, string][] = [
    [0, 'low', 'Baja carga'],
    [49, 'low', 'Baja carga'],
    [49.99, 'low', 'Baja carga'],
    [50, 'available', 'Disponible'],
    [50.01, 'available', 'Disponible'],
    [84.99, 'available', 'Disponible'],
    [85, 'available', 'Disponible'], // 85 % inclusive es Disponible
    [85.01, 'high', 'Alta ocupación'],
    [86, 'high', 'Alta ocupación'],
    [99.99, 'high', 'Alta ocupación'],
    [100, 'high', 'Alta ocupación'], // 100 % inclusive es Alta ocupación
    [100.01, 'over', 'Sobrecarga'],
    [101, 'over', 'Sobrecarga'],
    [250, 'over', 'Sobrecarga'],
  ];
  it.each(cases)('%s %% → %s', (pct, level, label) => {
    expect(occupancyLevel(pct)).toBe(level);
    expect(occupancyBand(pct)).toMatchObject({ level, label });
  });

  it('clasifica con el % real: 49,6 es Baja carga aunque se muestre redondeado a 50; 85,4 es Alta; 100,4 es Sobrecarga', () => {
    expect(Math.round(49.6)).toBe(50);
    expect(occupancyBand(49.6).level).toBe('low');
    expect(Math.round(85.4)).toBe(85);
    expect(occupancyBand(85.4).level).toBe('high');
    expect(Math.round(100.4)).toBe(100);
    expect(occupancyBand(100.4).level).toBe('over');
  });

  it('el cálculo de horas no mueve los límites por coma flotante', () => {
    expect(occupancyPct(34, 40).exact).toBe(85);
    expect(occupancyBand(occupancyPct(34, 40).exact).level).toBe('available');
    expect(occupancyBand(occupancyPct(17, 20).exact).level).toBe('available');
    expect(occupancyBand(occupancyPct(40, 40).exact).level).toBe('high');
    expect(occupancyBand(occupancyPct(20, 40).exact).level).toBe('available');
    expect(occupancyBand(occupancyPct(19.9, 40).exact).level).toBe('low');
    expect(occupancyBand(occupancyPct(40.1, 40).exact).level).toBe('over');
  });

  it('cada nivel tiene un tono semántico distinto (azul suave / verde / ámbar / rojo)', () => {
    const sample = { low: 10, available: 60, high: 90, over: 120 };
    expect(OCCUPANCY_LEVELS.map((l) => occupancyBand(sample[l]).tone)).toEqual(['available', 'good', 'warning', 'critical']);
  });

  it('el porcentaje mostrado nunca contradice el estado: entero salvo cuando redondear cruzaría un límite', () => {
    expect(formatOccupancyPct(85)).toBe('85%');
    expect(formatOccupancyPct(85.6)).toBe('86%');
    expect(formatOccupancyPct(85.4)).toBe('85.4%'); // Alta ocupación: no puede leerse «85 %»
    expect(formatOccupancyPct(49.6)).toBe('49.6%'); // Baja carga: no puede leerse «50 %»
    expect(formatOccupancyPct(100.4)).toBe('100.4%'); // Sobrecarga: no puede leerse «100 %»
    expect(formatOccupancyPct(100)).toBe('100%');
    for (const p of [49.5, 49.6, 49.99, 84.5, 85.01, 85.4, 99.99, 100.004, 100.4, 100.6]) {
      expect(occupancyLevel(parseFloat(formatOccupancyPct(p)))).toBe(occupancyLevel(p));
    }
  });
});

describe('bandas de ocupación: conteos y períodos', () => {
  const mk = (cap: number, carga: number) => member('x', 'x', cap, carga, [carga, 0, 0, 0]);
  it('los conteos de colaboradores salen del % individual real, no del risk_level del servidor (que aquí dice OK para todos)', () => {
    const members = [mk(100, 49.9), mk(100, 50), mk(100, 85), mk(100, 85.1), mk(100, 100), mk(100, 100.1), mk(0, 0)];
    expect(occupancyCounts(members)).toEqual({ low: 1, available: 2, high: 2, over: 1, sinCapacidad: 1 });
  });
  it('periodSnapshot y los KPIs usan el mismo % real en los tres períodos', () => {
    const m = member('1', 'A', 40, 34, [34, 40, 41, 20]);
    expect(periodSnapshot(m, 'current').pctExact).toBe(85);
    expect(periodSnapshot(m, 'next').pctExact).toBe(100);
    expect(occupancyBand(periodSnapshot(m, 'next').pctExact).level).toBe('high');
    expect(periodSnapshot(m, 'next4').pctExact).toBeCloseTo((135 / 160) * 100, 10);
    const k = aggregatePeriodKpis([m], 'current');
    expect(k.ocupacionExact).toBe(85);
    expect(occupancyBand(k.ocupacionExact).label).toBe('Disponible');
    expect(aggregatePeriodKpis([member('2', 'B', 40, 40.4, [40.4, 0, 0, 0])], 'current').sobrecargadas).toBe(1);
    expect(aggregatePeriodKpis([member('2', 'B', 40, 40, [40, 0, 0, 0])], 'current').sobrecargadas).toBe(0);
  });
  it('la banda oficial del equipo sale de weeklyOccupancy con el % real', () => {
    expect(weeklyOccupancy([member('1', 'A', 100, 85.4, [85.4])]).band.label).toBe('Alta ocupación');
    expect(weeklyOccupancy([member('1', 'A', 100, 85, [85])]).band.label).toBe('Disponible');
  });
});

describe('bandas de ocupación: mismo estado en las tres pestañas', () => {
  // scenario(): 85,5 h de 100 h → 85,5 % → Alta ocupación en TODAS (se muestra 86 %).
  it('Equipo, Capacidad y Capacidad Operativa muestran la misma etiqueta de estado', async () => {
    scenario();
    expect(bandIn(operativaTile().textContent!)).toEqual(['Alta ocupación']);
    cleanup();
    await equipoPage();
    expect(bandIn(screen.getByTestId('ocupacion-estado').textContent!)).toEqual(['Alta ocupación']);
  });

  it('en el límite (85 %) las tres coinciden en «Disponible»', async () => {
    data.members = [member('1', 'Ana', 100, 85, [85, 0, 0, 0], { backlog: 85 })];
    data.pendingTotal = 85;
    expect(bandIn(operativaTile().textContent!)).toEqual(['Disponible']);
    cleanup();
    await equipoPage();
    expect(screen.getByTestId('ocupacion-estado').textContent).toBe('Equipo: Disponible');
  });

  it('con 100,4 % las tres dicen «Sobrecarga» y ninguna muestra «100%» a secas', async () => {
    data.members = [member('1', 'Ana', 1000, 1004, [1004, 0, 0, 0], { backlog: 1004 })];
    data.pendingTotal = 1004;
    const tile = operativaTile();
    expect(bandIn(tile.textContent!)).toEqual(['Sobrecarga']);
    expect(tile.querySelector('.stat-tile-value')!.textContent).toBe('100.4%');
    cleanup();
    await equipoPage();
    expect(screen.getByTestId('ocupacion-estado').textContent).toBe('Equipo: Sobrecarga');
  });

  it('Equipo: los contadores salen del % real de cada persona (Ana 76 % Disponible, Luis 125 % Sobrecarga, Eva 25 % Baja carga)', async () => {
    scenario();
    await equipoPage();
    expect(screen.getByTestId('conteo-available').textContent).toBe('Disponible · 1');
    expect(screen.getByTestId('conteo-over').textContent).toBe('Sobrecarga · 1');
    expect(screen.getByTestId('conteo-low').textContent).toBe('Baja carga · 1');
    expect(screen.queryByTestId('conteo-high')).toBeNull();
  });

  it('Capacidad Operativa: las filas de la tabla usan las mismas bandas', () => {
    scenario();
    operativaTile();
    const pills = Array.from(document.querySelectorAll('tbody tr')).map((tr) => bandIn(tr.textContent ?? '')).flat();
    expect(pills.filter((l) => l === 'Sobrecarga')).toHaveLength(1);
    expect(pills.filter((l) => l === 'Disponible')).toHaveLength(1);
    expect(pills.filter((l) => l === 'Baja carga').length).toBeGreaterThanOrEqual(1);
  });

  it('«Ocupación total» queda independiente: sin bandas de ocupación, con % y semanas', () => {
    scenario();
    const card = fabricaCard();
    const box = screen.getByTestId('ocupacion-total-formula');
    expect(box.textContent).toMatch(/Ocupación total/);
    expect(box.textContent).toMatch(/semana/);
    expect(bandIn(box.textContent!)).toEqual([]);
    expect(card.contains(box)).toBe(false);
    expect(document.body.textContent).not.toMatch(/No cabe en la semana|Casi llena|Cabe esta semana/);
  });
});

describe('regresión: sin criterios antiguos de estado de ocupación', () => {
  const read = (p: string) => readFileSync(p, 'utf8');
  // Sin comentarios: aquí importa el código, no las notas que explican por qué no se usa el criterio antiguo.
  const code = (p: string) => read(p).split('\n').filter((l) => !/^\s*(\/\/|\{?\/\*)/.test(l)).join('\n');
  const tabs: Record<string, string> = {
    equipo: code('src/pages/Reports.tsx'),
    fabrica: code('src/components/reports/CapacidadFabricaTab.tsx'),
    operativa: code('src/components/reports/CapacidadOperativaTab.tsx'),
  };
  it('ninguna pestaña usa operativeBand, bandFor ni los conteos/colores de riesgo del servidor para la ocupación semanal', () => {
    for (const [name, src] of Object.entries(tabs)) {
      expect(src, name).not.toMatch(/operativeBand|\bbandFor\b|risk_counts|RISK_BADGE_CLASSES/);
    }
    expect(tabs.equipo).not.toMatch(/current\.risk_(level|label|color)|w\.risk_color/);
  });
  it('los umbrales viven solo en lib/capacityMetrics (ninguna pestaña compara el % contra 50/85/90/100 para clasificar)', () => {
    for (const [name, src] of Object.entries(tabs)) {
      expect(src, name).not.toMatch(/(pctExact|ocupacion\w*|occ\.pct\w*|snap\.pct\w*)\s*(>=|<=|>|<)\s*(50|60|61|85|86|90|100)\b/);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// OCUPACIÓN TOTAL (backlog pendiente de la población activa ÷ capacidad de UNA semana): tarjeta principal
// de Capacidad y de Capacidad Operativa. Misma función, mismos datos, mismo porcentaje.
// ---------------------------------------------------------------------------------------------
const totalCard = () => screen.getByTestId('ocupacion-total');
const totalPctText = () => screen.getByTestId('ocupacion-total-pct').textContent!;

describe('ocupación total: igual en Capacidad y Capacidad Operativa', () => {
  it('muestran la misma tarjeta, con el mismo porcentaje, horas, capacidad y semanas', () => {
    scenario(); // pendiente de la población activa: 120 + 90 + 5 = 215 h; capacidad semanal 100 h
    operativaTile();
    const enOperativa = totalCard().textContent!;
    const pctOperativa = totalPctText();
    cleanup();
    fabricaCard();
    const enFabrica = totalCard().textContent!;
    expect(totalPctText()).toBe(pctOperativa);
    expect(pctOperativa).toBe('215%');
    expect(enFabrica).toBe(enOperativa);
    expect(enFabrica).toMatch(/215h pendientes/);
    expect(enFabrica).toMatch(/100h de capacidad semanal de referencia/);
    expect(enFabrica).toMatch(/≈ 2\.2 semanas/);
    expect(enFabrica).toMatch(/backlog total/);
  });

  it('se llama «Ocupación total» y no recibe etiquetas de las bandas de ocupación semanal aunque supere 100 %', () => {
    scenario();
    operativaTile();
    expect(totalCard()).toHaveTextContent('Ocupación total');
    expect(bandIn(totalCard().textContent!)).toEqual([]);
    expect(totalCard().textContent).not.toMatch(/Sobrecarga/);
  });

  it('no depende del período ni de los filtros: Operativa lo pide sin cargo, proyecto ni período', () => {
    scenario();
    data.forecastCalls.length = 0;
    operativaTile();
    expect(data.forecastCalls).toContainEqual({ weeks: 4 });
  });

  it('la ocupación semanal (indicador secundario) sigue en Operativa con su propio valor y su estado', () => {
    scenario();
    const tile = operativaTile();
    expect(tile.querySelector('.stat-tile-value')!.textContent).toBe('86%');
    expect(bandIn(tile.textContent!)).toEqual(['Alta ocupación']);
    expect(totalPctText()).toBe('215%'); // el total no cambia por existir el indicador semanal
  });

  it('Capacidad solo muestra la ocupación total; la semanal sigue en Equipo y Capacidad Operativa', () => {
    scenario();
    fabricaCard();
    sinOcupacionSemanal();
    expect(totalPctText()).toBe('215%');
  });
});

describe('ocupación total: población, tareas y casos límite', () => {
  it('numerador y denominador salen de la MISMA población y las horas fuera de ella no entran en el %', () => {
    const r = [member('1', 'Ana', 40, 0, [0], { backlog: 30 }), member('2', 'Luis', 20, 0, [0], { backlog: 15 })];
    const t = totalOccupancy(r, 500); // 500 h pendientes en toda la fábrica (incluye inactivos / sin cargo / sin responsable)
    expect(t.horasActivas).toBe(45);
    expect(t.capacidadSemanal).toBe(60);
    expect(t.pct).toBe(75);
    expect(t.fueraDeCapacidad).toBe(455);
    // sumar una persona suma sus horas Y su capacidad
    const t2 = totalOccupancy([...r, member('3', 'Eva', 20, 0, [0], { backlog: 5 })]);
    expect(t2.horasActivas).toBe(50);
    expect(t2.capacidadSemanal).toBe(80);
  });

  it('incluye TODO lo pendiente sin importar el vencimiento (no solo la semana actual)', () => {
    const m = member('1', 'Ana', 40, 4, [4, 0, 0, 0], { backlog: 100 }); // 4 h esta semana, 100 h pendientes en total
    expect(totalOccupancy([m]).horasActivas).toBe(100);
    expect(weeklyOccupancy([m]).horas).toBe(4);
  });

  it('las tareas completadas no cuentan: el backlog del servidor filtra NOT is_completed (regla existente)', () => {
    const sql = readFileSync('server/src/controllers/reportsController.ts', 'utf8');
    expect(sql).toMatch(/SUM\(horas_estimadas\) FILTER \(WHERE NOT is_completed\), 0\) as horas_backlog_total/);
  });

  it('supera 100 %: 215 % ≈ 2,2 semanas y la tarjeta lo explica sin clasificarlo', () => {
    scenario();
    fabricaCard();
    expect(totalPctText()).toBe('215%');
    expect(totalCard()).toHaveTextContent('Supera en 115% la capacidad de una semana');
    expect(totalOccupancy(data.members).pct).toBeGreaterThan(100);
  });

  it('con 95,6 % no hay exceso y se muestra con un decimal', () => {
    data.members = [member('1', 'Ana', 40, 0, [0], { backlog: 38.24 })];
    data.pendingTotal = 38.24;
    fabricaCard();
    expect(totalPctText()).toBe('95.6%');
    expect(totalCard().textContent).not.toMatch(/Supera en/);
  });

  it('capacidad semanal cero: sin NaN/Infinity, «—» y aviso, igual en ambas pestañas', () => {
    data.members = [member('1', 'Ana', 0, 0, [0], { backlog: 12 })];
    data.pendingTotal = 12;
    expect(totalOccupancy(data.members)).toMatchObject({ pct: 0, semanas: 0, capacidadSemanal: 0, horasActivas: 12 });
    operativaTile();
    expect(totalPctText()).toBe('—');
    expect(screen.getByTestId('ocupacion-total-sin-capacidad')).toBeInTheDocument();
    expect(totalCard().textContent).not.toMatch(/NaN|Infinity/);
    cleanup();
    fabricaCard();
    expect(totalPctText()).toBe('—');
    expect(screen.getByTestId('ocupacion-total-sin-capacidad')).toBeInTheDocument();
  });

  it('tareas sin horas estimadas: no suman horas, se avisan y el aviso es el mismo en ambas pestañas', () => {
    data.members = [member('1', 'Ana', 40, 0, [0], { backlog: 20, sinEstBacklog: 3 })];
    data.pendingTotal = 20;
    expect(totalOccupancy(data.members)).toMatchObject({ horasActivas: 20, pct: 50, tareasSinEstimar: 3 });
    operativaTile();
    const aviso = screen.getByTestId('ocupacion-total-sin-estimar').textContent!;
    expect(aviso).toMatch(/3 tareas pendientes no tienen horas estimadas y no se cuentan/);
    cleanup();
    fabricaCard();
    expect(screen.getByTestId('ocupacion-total-sin-estimar').textContent).toBe(aviso);
    expect(totalPctText()).toBe('50%');
  });

  it('sin tareas sin estimar no aparece el aviso', () => {
    scenario();
    fabricaCard();
    expect(screen.queryByTestId('ocupacion-total-sin-estimar')).toBeNull();
  });

  it('los indicadores semanales y por período siguen calculándose igual', () => {
    const m = member('1', 'Ana', 40, 34, [34, 40, 41, 20], { backlog: 300 });
    expect(weeklyOccupancy([m]).pct).toBe(85);
    expect(periodSnapshot(m, 'next').pct).toBe(100);
    expect(aggregatePeriodKpis([m], 'next4').ocupacion).toBe(Math.round((135 / 160) * 100));
    expect(totalOccupancy([m]).pct).toBe(750); // 300 h ÷ 40 h: el total no cambia con el período
  });
});

describe('regresión: una sola fuente para la ocupación total', () => {
  const read = (p: string) => readFileSync(p, 'utf8');
  const code = (p: string) => read(p).split('\n').filter((l) => !/^\s*(\/\/|\{?\/\*)/.test(l)).join('\n');
  const operativa = code('src/components/reports/CapacidadOperativaTab.tsx');
  const fabrica = code('src/components/reports/CapacidadFabricaTab.tsx');
  const hook = code('src/hooks/useFactoryOccupancy.ts');

  it('ambas pestañas usan el mismo hook y el mismo componente de tarjeta', () => {
    for (const src of [operativa, fabrica]) {
      expect(src).toContain('useFactoryOccupancy()');
      expect(src).toContain('<TotalOccupancyCard total=');
    }
  });
  it('ninguna calcula la ocupación total por su cuenta (solo el hook llama a totalOccupancy con datos)', () => {
    expect(operativa).not.toMatch(/totalOccupancy\(/);
    expect(fabrica.match(/totalOccupancy\(/g)).toHaveLength(1);
    expect(fabrica).toContain('totalOccupancy([])');
    expect(hook).toMatch(/totalOccupancy\(members, horasPendientesFabrica\)/);
  });
  it('el hook consulta sin filtros de cargo, proyecto ni período', () => {
    expect(hook).toContain('useReportCapacityForecast({ weeks: 4 })');
  });
  it('no usa los totales precalculados del servidor (utilizacion_pct_fabrica, equipo_ocupado) ni risk_level para este indicador', () => {
    expect(fabrica).not.toMatch(/utilizacion_pct_fabrica|utilizacion_pct_equipo_ocupado/);
    expect(hook).not.toMatch(/utilizacion_pct|risk_/);
  });
});
