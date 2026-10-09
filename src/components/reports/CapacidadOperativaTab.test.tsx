import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';

const week = (n: number, horas: number, cap: number) => ({
  week_start: `2026-10-${String(5 + n * 7).padStart(2, '0')}`,
  es_semana_actual: n === 0,
  horas,
  utilizacion_pct: Math.round((horas / cap) * 100),
  holgura_horas: cap - horas,
  risk_level: 'ok', risk_label: 'OK', risk_color: 'emerald',
});
const member = (id: string, name: string, current: number, weeks: number[], backlog: number) => ({
  id, full_name: name, cargo: 'Diseñador', avatar_url: null, weekly_hours_capacity: 40,
  current: {
    horas_vencidas: 0, horas_semana_actual: current, carga_semana_actual: current,
    utilizacion_pct: Math.round((current / 40) * 100), holgura_horas: 40 - current,
    risk_level: 'ok', risk_label: 'OK', risk_color: 'emerald',
    unidades_semana_actual_sin_estimacion: 0, carga_semana_actual_aprox: current,
    utilizacion_aprox_pct: 0, holgura_aprox_horas: 0,
  },
  weeks: weeks.map((h, i) => week(i, h, 40)),
  backlog: { horas_total: backlog, horas_sin_fecha: 0, unidades_sin_estimacion: 0, dias_para_vaciar: 5, fecha_backlog_vacio: null },
});

const members = [
  member('1', 'Ana Pérez', 50, [30, 20, 10, 0], 100),
  member('2', 'Luis Gómez', 10, [10, 5, 5, 5], 20),
];

const flags = { loading: false, error: false, workloadError: false, keepData: false, refetch: vi.fn() };
vi.mock('@/hooks/useReports', () => ({
  useReportCapacityForecast: () => ({
    data: flags.error && !flags.keepData ? undefined : { members }, isLoading: flags.loading, isError: flags.error, error: flags.error ? new Error('sin red') : null, isFetching: false, refetch: flags.refetch,
  }),
  useReportPeopleWorkload: () => ({ data: flags.workloadError ? undefined : { people: [] }, isLoading: flags.loading, isError: flags.workloadError, error: flags.workloadError ? new Error('workload caído') : null, isFetching: false, refetch: flags.refetch }),
  useReportWorkloadByCargo: () => ({ data: [] }),
  useUserMiniReport: () => ({ data: undefined, isLoading: false }),
}));
vi.mock('@/hooks/useProjects', () => ({ useProjects: () => ({ data: [] }) }));

import { CapacidadOperativaTab } from './CapacidadOperativaTab';

beforeAll(() => {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
});

const tile = (label: string) => {
  const found = Array.from(document.querySelectorAll<HTMLElement>('.stat-tile')).find(
    (el) => el.textContent?.startsWith(label),
  );
  if (!found) throw new Error(`No hay ficha "${label}"`);
  return found;
};

const choosePeriod = (label: string) => {
  const trigger = screen.getAllByRole('combobox')[0];
  fireEvent.keyDown(trigger, { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: label }));
};

describe('CapacidadOperativaTab (render de humo)', () => {
  it('período por defecto: indicadores coherentes (capacidad 80h, carga 60h, disponible 20h, ocupación 75%, 1 sobrecargada)', () => {
    render(<TooltipProvider><CapacidadOperativaTab /></TooltipProvider>);
    expect(within(tile('Capacidad del período')).getByText('80h')).toBeInTheDocument();
    expect(within(tile('Carga del período')).getByText('60h')).toBeInTheDocument();
    expect(within(tile('Horas disponibles')).getByText('20h')).toBeInTheDocument();
    expect(within(tile('Ocupación')).getByText('75%')).toBeInTheDocument();
    expect(within(tile('Sobrecarga del equipo')).getByText('1')).toBeInTheDocument();
  });
  it('la tarjeta de backlog usa una semana de capacidad (80h) y 120h de backlog = 1.5 sem', () => {
    render(<TooltipProvider><CapacidadOperativaTab /></TooltipProvider>);
    expect(screen.getByText('1.5 sem')).toBeInTheDocument();
    expect(screen.getByText('Espacio limitado')).toBeInTheDocument();
  });

  it('próxima semana: capacidad 80h, carga 25h (20+5), disponible 55h, ocupación 31%, sin sobrecarga', () => {
    render(<TooltipProvider><CapacidadOperativaTab /></TooltipProvider>);
    choosePeriod('Próxima semana');
    expect(within(tile('Capacidad del período')).getByText('80h')).toBeInTheDocument();
    expect(within(tile('Carga del período')).getByText('25h')).toBeInTheDocument();
    expect(within(tile('Horas disponibles')).getByText('55h')).toBeInTheDocument();
    expect(within(tile('Ocupación')).getByText('31%')).toBeInTheDocument();
    expect(within(tile('Sobrecarga del equipo')).getByText('0')).toBeInTheDocument();
  });

  it('próximas 4 semanas: capacidad 320h, carga 85h, la tarjeta de backlog NO cambia (sigue 1.5 sem)', () => {
    render(<TooltipProvider><CapacidadOperativaTab /></TooltipProvider>);
    choosePeriod('Próximas 4 semanas');
    expect(within(tile('Capacidad del período')).getByText('320h')).toBeInTheDocument();
    expect(within(tile('Carga del período')).getByText('85h')).toBeInTheDocument();
    expect(within(tile('Horas disponibles')).getByText('235h')).toBeInTheDocument();
    expect(within(tile('Ocupación')).getByText('27%')).toBeInTheDocument();
    expect(screen.getByText('1.5 sem')).toBeInTheDocument();
  });

  it('la nota de alcance nombra el período elegido y separa el backlog total', () => {
    render(<TooltipProvider><CapacidadOperativaTab /></TooltipProvider>);
    expect(screen.getByTestId('kpi-scope-note')).toHaveTextContent('Indicadores de esta semana');
    choosePeriod('Próximas 4 semanas');
    expect(screen.getByTestId('kpi-scope-note')).toHaveTextContent('Indicadores de próximas 4 semanas');
    expect(screen.getByTestId('kpi-scope-note')).toHaveTextContent('backlog total se mide aparte');
  });

  it('datos vacíos: sin miembros no hay NaN ni caídas', () => {
    const saved = members.splice(0, members.length);
    try {
      expect(() => render(<TooltipProvider><CapacidadOperativaTab /></TooltipProvider>)).not.toThrow();
      expect(document.body.textContent).not.toMatch(/NaN|undefined|Infinity/);
    } finally {
      members.push(...saved);
    }
  });

  it('cargando: esqueleto con la forma de la página; error: alerta con Reintentar (no «sin datos»)', () => {
    flags.loading = true;
    const a = render(<TooltipProvider><CapacidadOperativaTab /></TooltipProvider>);
    expect(screen.getByRole('status', { name: 'Cargando capacidad operativa' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    a.unmount();

    flags.loading = false; flags.error = true; flags.refetch = vi.fn();
    render(<TooltipProvider><CapacidadOperativaTab /></TooltipProvider>);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar la capacidad operativa.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(flags.refetch).toHaveBeenCalled();
    flags.error = false;
  });

  it('las cabeceras ordenables son botones y exponen aria-sort', () => {
    render(<TooltipProvider><CapacidadOperativaTab /></TooltipProvider>);
    const th = screen.getAllByRole('columnheader').find((h) => h.hasAttribute('aria-sort') && h.textContent?.includes('Colaborador'))!;
    expect(th).toHaveAttribute('aria-sort', 'none');
    const btn = within(th).getByRole('button', { name: /Colaborador/ });
    fireEvent.click(btn);
    expect(th).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(btn);
    expect(th).toHaveAttribute('aria-sort', 'descending');
  });

  it('error al actualizar con datos previos: se mantienen las fichas y se avisa (no se oculta la vista)', () => {
    flags.error = true; flags.keepData = true;
    render(<TooltipProvider><CapacidadOperativaTab /></TooltipProvider>);
    expect(within(tile('Capacidad del período')).getByText('80h')).toBeInTheDocument();
    expect(screen.getByText(/Se muestran los datos anteriores/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    flags.error = false; flags.keepData = false;
  });

  it('consultas concurrentes: si falla la de carga por proyecto sin datos, se explica y se puede reintentar', () => {
    flags.workloadError = true; flags.refetch = vi.fn();
    render(<TooltipProvider><CapacidadOperativaTab /></TooltipProvider>);
    expect(screen.getByRole('alert')).toHaveTextContent('workload caído');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(flags.refetch).toHaveBeenCalled();
    flags.workloadError = false;
  });
});
