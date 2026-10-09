import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApiRequestError } from '@/lib/apiError';

// Estados de carga / error / vacío de páginas que antes no los distinguían.

const q = {
  notifications: { data: [] as unknown, isLoading: false, isError: false, error: null as unknown, isFetching: false, refetch: vi.fn() },
  equipos: { data: [] as unknown, isLoading: false, isError: false, error: null as unknown, isFetching: false, refetch: vi.fn() },
  profiles: { data: [] as unknown, isError: false },
};
vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => q.notifications,
  useMarkNotificationRead: () => ({ mutate: vi.fn() }),
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteNotification: () => ({ mutate: vi.fn() }),
  useUnreadNotificationsCount: () => ({ data: 0 }),
}));
vi.mock('@/hooks/useEquipos', () => ({ useEquipos: () => q.equipos }));
vi.mock('@/hooks/useProfiles', () => ({ useProfiles: () => q.profiles }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isProjectLeader: true, isAdmin: false }) }));
vi.mock('@/components/equipos/EditEquipoDialog', () => ({ EditEquipoDialog: () => null }));

import NotificationsPage from './Notifications';
import EquiposPage from './Equipos';

const base = { isLoading: false, isError: false, error: null, isFetching: false, refetch: vi.fn() };
beforeAll(() => { Element.prototype.hasPointerCapture = () => false; });
beforeEach(() => {
  q.notifications = { ...base, data: [], refetch: vi.fn() };
  q.equipos = { ...base, data: [], refetch: vi.fn() };
  q.profiles = { data: [], isError: false };
});
const page = (el: JSX.Element) => render(<MemoryRouter>{el}</MemoryRouter>);
const notif = { id: 'n1', title: 'Tarea asignada', message: 'Te asignaron una tarea', read: false, created_at: '2026-10-01T10:00:00Z', project_id: null, task_id: null, type: 'task_assigned' };

describe('Notificaciones', () => {
  it('cargando → esqueleto; sin mensajes de vacío ni de error', () => {
    q.notifications = { ...base, data: undefined, isLoading: true };
    page(<NotificationsPage />);
    expect(screen.getByRole('status', { name: 'Cargando página' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('error sin datos → motivo + Reintentar (no «sin notificaciones»)', () => {
    q.notifications = { ...base, data: undefined, isError: true, error: new ApiRequestError('Servicio no disponible', 503) };
    page(<NotificationsPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar las notificaciones.');
    expect(screen.getByRole('alert')).toHaveTextContent('Servicio no disponible');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(q.notifications.refetch).toHaveBeenCalledTimes(1);
  });
  it('error de permisos → explica, sin Reintentar', () => {
    q.notifications = { ...base, data: undefined, isError: true, error: new ApiRequestError('Acceso denegado', 403) };
    page(<NotificationsPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Sin permiso');
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });
  it('error al actualizar con datos previos → se conservan y se avisa', () => {
    q.notifications = { ...base, data: [notif], isError: true, error: new ApiRequestError('timeout', 504) };
    page(<NotificationsPage />);
    expect(screen.getByText('Tarea asignada')).toBeInTheDocument();
    expect(screen.getByText(/Se muestran los datos anteriores/)).toBeInTheDocument();
  });
  it('reintento exitoso: al llegar los datos desaparece el error', () => {
    q.notifications = { ...base, data: undefined, isError: true, error: new Error('x') };
    const a = page(<NotificationsPage />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    a.unmount();
    q.notifications = { ...base, data: [notif] };
    page(<NotificationsPage />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Tarea asignada')).toBeInTheDocument();
  });
});

describe('Equipos', () => {
  it('cargando → esqueletos; error sin datos → alerta con Reintentar', () => {
    q.equipos = { ...base, data: undefined, isLoading: true };
    const a = page(<EquiposPage />);
    expect(screen.getByRole('status', { name: 'Cargando indicadores' })).toBeInTheDocument();
    a.unmount();
    q.equipos = { ...base, data: undefined, isError: true, error: new ApiRequestError('boom', 500) };
    page(<EquiposPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar los equipos.');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
  it('lista realmente vacía → mensaje propio, sin alerta', () => {
    page(<EquiposPage />);
    expect(screen.getByText('Aún no hay equipos creados.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('si fallan las personas, «Personas sin equipo» muestra — y no un 0 engañoso', () => {
    q.equipos = { ...base, data: [{ id: 'e1', name: 'Diseño', color: '#0DD9D0', members: [] }] };
    q.profiles = { data: undefined, isError: true };
    page(<EquiposPage />);
    const tile = Array.from(document.querySelectorAll('.stat-tile')).find((t) => t.textContent?.includes('Personas sin equipo'))!;
    expect(tile).toHaveTextContent('—');
  });
});
