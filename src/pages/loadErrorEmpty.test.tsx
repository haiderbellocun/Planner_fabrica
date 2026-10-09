import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ErrorState } from '@/components/shared/StoryUI';

// Carga, error, vacío real y vacío por filtros deben ser cuatro estados distintos.

const auth = { isAdmin: true, isProjectLeader: false, user: { role: 'admin' }, profile: { full_name: 'Ana Pérez' } };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

const q = {
  projects: [] as unknown[] | undefined, isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
};
vi.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({ data: q.projects, isLoading: q.isLoading, isError: q.isError, isFetching: q.isFetching, refetch: q.refetch }),
  usePinProject: () => ({ mutate: vi.fn() }),
  useUnpinProject: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/hooks/useNotifications', () => ({ useNotifications: () => ({ data: [] }) }));
vi.mock('@/components/project/CreateProjectWizard', () => ({ CreateProjectWizard: () => null }));
vi.mock('@/components/project/VirtualizacionToggle', () => ({ VirtualizacionToggle: () => null }));
vi.mock('@/components/dashboard/MyFocusToday', () => ({ MyFocusToday: () => null }));

import ProjectsPage from './Projects';
import DashboardPage from './Dashboard';

const project = (over: Record<string, unknown> = {}) => ({
  id: 'p1', name: 'Proyecto Alfa', key: 'ALF', status: 'active', tipo_programa: 'profesional', end_date: '2026-03-01',
  es_virtualizacion: null, tasks_count: 4, completed_tasks: 1, members: [], members_count: 0, is_pinned: false, description: null, ...over,
});

beforeAll(() => { Element.prototype.hasPointerCapture = () => false; });
beforeEach(() => {
  q.projects = []; q.isLoading = false; q.isError = false; q.isFetching = false; q.refetch = vi.fn();
  auth.isAdmin = true; auth.user.role = 'admin';
});

const page = (el: JSX.Element) => render(<MemoryRouter>{el}</MemoryRouter>);

describe('ErrorState', () => {
  it('es un alert; «Reintentar» llama a la acción y se bloquea mientras reintenta', () => {
    const retry = vi.fn();
    const { rerender } = render(<ErrorState message="Falló" onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Falló');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(retry).toHaveBeenCalledTimes(1);
    rerender(<ErrorState message="Falló" onRetry={retry} retrying />);
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeDisabled();
  });
  it('sin onRetry no muestra el botón', () => {
    render(<ErrorState />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Proyectos: cuatro estados distintos', () => {
  it('cargando: esqueleto accesible, sin mensajes de error ni de vacío', () => {
    q.isLoading = true;
    page(<ProjectsPage />);
    expect(screen.getByRole('status', { name: 'Cargando proyectos' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('No hay proyectos')).not.toBeInTheDocument();
  });
  it('error de la API: alerta con Reintentar y NUNCA «No hay proyectos»', () => {
    q.isError = true; q.projects = undefined; // un error sin datos previos: no hay data
    page(<ProjectsPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar los proyectos.');
    expect(screen.queryByText('No hay proyectos')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(q.refetch).toHaveBeenCalledTimes(1);
  });
  it('vacío real: invita a crear el primer proyecto', () => {
    page(<ProjectsPage />);
    expect(screen.getByText('No hay proyectos')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('sin resultados por filtros: mensaje propio y «Limpiar filtros» restablece la lista', () => {
    q.projects = [project()];
    page(<ProjectsPage />);
    expect(screen.getByText('Proyecto Alfa')).toBeInTheDocument();
    // un filtro de estado que no coincide con ningún proyecto
    fireEvent.click(screen.getByRole('button', { name: /Pausado/ }));
    expect(screen.getByText('Ningún proyecto coincide con los filtros seleccionados.')).toBeInTheDocument();
    expect(screen.queryByText('No hay proyectos')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByText('Proyecto Alfa')).toBeInTheDocument();
  });
  it('si hay datos en caché y el refetch falla, se siguen mostrando los proyectos', () => {
    q.projects = [project()]; q.isError = true;
    page(<ProjectsPage />);
    expect(screen.getByText('Proyecto Alfa')).toBeInTheDocument();
  });
});

describe('Dashboard', () => {
  it('cargando: esqueleto con la forma de la página (no un spinner a pantalla completa)', () => {
    q.isLoading = true;
    page(<DashboardPage />);
    expect(screen.getByRole('status', { name: 'Cargando inicio' })).toBeInTheDocument();
  });
  it('error: «No disponible» y alerta con Reintentar en lugar de «No tienes proyectos aún» y ceros', () => {
    q.isError = true; q.projects = undefined;
    page(<DashboardPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar tus proyectos.');
    expect(screen.queryByText('No tienes proyectos aún')).not.toBeInTheDocument();
    expect(screen.getAllByText('No disponible').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(q.refetch).toHaveBeenCalled();
  });
  it('vacío real: «No tienes proyectos aún» sin alerta', () => {
    page(<DashboardPage />);
    expect(screen.getByText('No tienes proyectos aún')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
