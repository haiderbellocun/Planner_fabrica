import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Validación de las optimizaciones de P1-E: permisos con rutas diferidas, pestañas bajo demanda y Excel.

const auth = { user: { id: 'u1' }, isLoading: false, isAdmin: false, isProjectLeader: false };
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => auth,
}));
vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}));
vi.mock('@/components/ui/toaster', () => ({ Toaster: () => null }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('./../pages/Dashboard', () => ({ default: () => <div>Pagina Dashboard</div> }));
vi.mock('@/hooks/useMateriales', () => ({ useMaterialTypes: () => ({ data: [], isLoading: false }) }));
vi.mock('@/hooks/useTiemposEstimados', () => ({ useTiemposEstimados: () => ({ data: [], isLoading: false }) }));

import App from '../App';

beforeAll(() => { Element.prototype.hasPointerCapture = () => false; });
beforeEach(() => { window.location.hash = ''; auth.isAdmin = false; auth.isProjectLeader = false; });

describe('rutas diferidas conservan sus permisos', () => {
  it('colaborador en /calculator: la página diferida lo redirige al inicio', async () => {
    window.location.hash = '#/calculator';
    render(<App />);
    expect(await screen.findByText('Pagina Dashboard', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/dashboard');
    expect(screen.queryByText('Calculadora de Proyectos')).not.toBeInTheDocument();
  });

  it('líder en /calculator: se descarga la página y se muestra la calculadora', async () => {
    auth.isProjectLeader = true;
    window.location.hash = '#/calculator';
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: /Calculadora de Proyectos/ })).toBeInTheDocument();
    expect(screen.queryByText('Pagina Dashboard')).not.toBeInTheDocument();
  });

  it('administrador también accede', async () => {
    auth.isAdmin = true;
    window.location.hash = '#/calculator';
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: /Calculadora de Proyectos/ })).toBeInTheDocument();
  });
});

describe('exportación a Excel', () => {
  it('la librería se carga con import() y expone lo que usan las exportaciones', async () => {
    const XLSX = await import('xlsx');
    expect(typeof XLSX.utils.json_to_sheet).toBe('function');
    expect(typeof XLSX.utils.book_new).toBe('function');
    expect(typeof XLSX.utils.book_append_sheet).toBe('function');
    expect(typeof XLSX.writeFile).toBe('function');
    const ws = XLSX.utils.json_to_sheet([{ Proyecto: 'Alfa', Estado: 'Aceptado' }]);
    expect(ws['A1'].v).toBe('Proyecto');
    expect(ws['B2'].v).toBe('Aceptado');
  });
});

// Pestañas de Reportes: el módulo de cada pestaña pesada solo se evalúa al abrirla.
const evaluated: string[] = [];
vi.mock('@/components/reports/CapacidadOperativaTab', () => {
  evaluated.push('operativa');
  return { CapacidadOperativaTab: () => <div>Contenido capacidad operativa</div> };
});
vi.mock('@/components/reports/CapacidadFabricaTab', () => { evaluated.push('fabrica'); return { CapacidadFabricaTab: () => <div>Contenido fábrica</div> }; });
vi.mock('@/components/reports/CoberturaFabricaTab', () => { evaluated.push('cobertura'); return { CoberturaFabricaTab: () => <div>Contenido cobertura</div> }; });
vi.mock('@/components/plan-trabajo/PlanDeTrabajoTab', () => { evaluated.push('plan'); return { PlanDeTrabajoTab: () => <div>Contenido plan</div> }; });
vi.mock('@/hooks/useReports', () => {
  const q = { data: undefined, isLoading: true, isError: false, error: null, isFetching: false, refetch: () => undefined };
  const names = ['useReportOverview', 'useReportProjectsProgress', 'useReportTeamPerformance', 'useReportTimeDistribution', 'useReportWorkflowTransitions', 'useReportWorkloadByCargo', 'useReportTeamCapacity', 'useUserMiniReport', 'useReportProjectCategories', 'useReportTasksWeeklyTrend', 'useReportProjectsTimeline', 'useReportTeamMonthlyCompletion', 'useReportTeamByCargo', 'useReportWeeklyByCargo', 'useReportUnassignedMaterials', 'useReportTimeByPhase', 'useReportTasksDetail', 'useReportIndividualPerformance', 'useReportOntimeByEquipo', 'useReportPersonMetrics', 'useReportCapacityForecast', 'useReportThroughput', 'useReportContentOverview', 'useReportUserLocations', 'useReportProjectUtilization', 'useReportProjectUtilizationDetail', 'useReportProductionCapacity', 'useReportPeopleWorkload'];
  return Object.fromEntries(names.map((n: string) => [n, () => q]));
});

describe('Reportes: pestañas bajo demanda', () => {
  it('al abrir Reportes no se evalúa ningún módulo de pestañas pesadas; se evalúa solo el de la pestaña que se abre', async () => {
    auth.isAdmin = true;
    window.location.hash = '#/reports';
    render(<App />);
    // la primera carga del módulo real de Reportes (recharts, etc.) puede tardar en el entorno de pruebas
    expect(await screen.findByRole('heading', { level: 1, name: 'Reportes' }, { timeout: 20000 })).toBeInTheDocument();
    expect(evaluated).toEqual([]);

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Capacidad Operativa/ }), { button: 0, ctrlKey: false });
    expect(await screen.findByText('Contenido capacidad operativa', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(evaluated).toEqual(['operativa']);
  }, 40000);
});
