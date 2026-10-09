import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';

// Carga diferida de rutas: el contenido entra con un esqueleto dentro del marco de la app y las
// páginas pesadas no forman parte del paquete inicial.

vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({ user: { id: 'u1' }, isLoading: false, isAdmin: false, isProjectLeader: false }),
}));
vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}));
vi.mock('@/components/ui/toaster', () => ({ Toaster: () => null }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('./../pages/Index', () => ({ default: () => <div>Pagina Index</div> }));
vi.mock('./../pages/Auth', () => ({ default: () => <div>Pagina Auth</div> }));
vi.mock('./../pages/MyTasks', () => ({ default: () => <div>Pagina MyTasks</div> }));
vi.mock('./../pages/Reports', () => ({ default: () => <div>Pagina Reports</div> }));
vi.mock('./../pages/NotFound', () => ({ default: () => <div>Pagina NotFound</div> }));
vi.mock('./../pages/GoogleAuthSuccess', () => ({ default: () => <div>Pagina Google</div> }));

import App from '../App';

describe('App: rutas con carga diferida', () => {
  beforeEach(() => { window.location.hash = ''; });

  it('muestra el esqueleto dentro del marco y luego la página', async () => {
    window.location.hash = '#/my-tasks';
    render(<App />);
    expect(screen.getByTestId('shell')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Cargando página' })).toBeInTheDocument();
    expect(await screen.findByText('Pagina MyTasks')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Cargando página' })).not.toBeInTheDocument();
  });

  it('navegar a otro módulo carga su propia página', async () => {
    window.location.hash = '#/reports';
    render(<App />);
    expect(await screen.findByText('Pagina Reports')).toBeInTheDocument();
    expect(screen.queryByText('Pagina MyTasks')).not.toBeInTheDocument();
  });

  it('las rutas de entrada (inicio, login) y el 404 no dependen de la carga diferida', async () => {
    window.location.hash = '#/auth';
    const a = render(<App />);
    expect(await screen.findByText('Pagina Auth')).toBeInTheDocument();
    a.unmount();
    window.location.hash = '#/ruta-que-no-existe';
    render(<App />);
    expect(await screen.findByText('Pagina NotFound')).toBeInTheDocument();
  });
});

describe('paquete inicial', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  it('las páginas pesadas se importan con import() dinámico, no estáticamente', () => {
    for (const p of ['Dashboard', 'Projects', 'ProjectDetail', 'Reports', 'Entregas', 'SolicitudesMarketing', 'Calendar', 'Settings']) {
      expect(app).toContain(`lazy(() => import("./pages/${p}"))`);
      expect(app).not.toMatch(new RegExp(`^import ${p} from`, 'm'));
    }
  });
  it('las pestañas pesadas de Reportes y la exportación a Excel también se cargan bajo demanda', () => {
    const reports = readFileSync('src/pages/Reports.tsx', 'utf8');
    for (const t of ['PlanDeTrabajoTab', 'CapacidadFabricaTab', 'CapacidadOperativaTab', 'CoberturaFabricaTab']) {
      expect(reports).toContain(`const ${t} = lazy(`);
      expect(reports).not.toMatch(new RegExp(`^import \\{ ${t} \\}`, 'm'));
    }
    for (const f of ['src/pages/Entregas.tsx', 'src/pages/SolicitudesMarketing.tsx']) {
      const src = readFileSync(f, 'utf8');
      expect(src).not.toMatch(/^import \* as XLSX/m);
      expect(src).toContain("await import('xlsx')");
    }
  });
});
