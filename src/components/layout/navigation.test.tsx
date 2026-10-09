import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getNavGroups, isNavItemActive, titleForPath, roleLabel } from './navConfig';

const auth = {
  user: { id: 'u1', full_name: 'Ana Pérez', email: 'ana@cun.edu.co', avatar_url: null },
  profile: { full_name: 'Ana Pérez', avatar_url: null },
  isLoading: false, isAdmin: false, isProjectLeader: false, signOut: vi.fn(),
};
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
const unread = { n: 0 };
vi.mock('@/hooks/useNotifications', () => ({ useUnreadNotificationsCount: () => ({ data: unread.n }) }));
vi.mock('@/components/chat/LuminaWidget', () => ({ LuminaWidget: () => null }));
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() }, apiBaseUrl: '' }));

import { AppLayout } from './AppLayout';

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.scrollIntoView = () => {};
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
beforeEach(() => { auth.isAdmin = false; auth.isProjectLeader = false; unread.n = 0; auth.signOut.mockClear(); });

const urls = (canManage: boolean) => getNavGroups({ canManage }).flatMap((g) => g.items.map((i) => i.url));

describe('navConfig: permisos y estructura (iguales a los de siempre)', () => {
  it('colaborador: Mi trabajo, Proyectos y Configuración; nada de gestión', () => {
    expect(urls(false)).toEqual(['/dashboard', '/my-tasks', '/calendar', '/notifications', '/projects', '/settings']);
  });
  it('líder/admin: además Próximos proyectos, Equipos, Reportes, Calculadora, Entregas y Marketing', () => {
    expect(urls(true)).toEqual([
      '/dashboard', '/my-tasks', '/calendar', '/notifications', '/projects', '/proximos-programas',
      '/equipos', '/reports', '/calculator', '/entregas', '/solicitudes-marketing', '/settings',
    ]);
  });
  it('no hay rutas repetidas y los accesos secundarios van en el grupo «Más»', () => {
    for (const c of [false, true]) expect(new Set(urls(c)).size).toBe(urls(c).length);
    const mas = getNavGroups({ canManage: true }).find((g) => g.id === 'mas')!;
    expect(mas.secondary).toBe(true);
    expect(mas.items.map((i) => i.url)).toContain('/entregas');
    expect(getNavGroups({ canManage: true }).filter((g) => g.secondary)).toHaveLength(1);
  });
  it('Notificaciones lleva el contador', () => {
    expect(getNavGroups({ canManage: false })[0].items.find((i) => i.url === '/notifications')?.badge).toBe('notifications');
  });
  it('estado activo: Proyectos y Equipos siguen resaltados en sus rutas hijas', () => {
    expect(isNavItemActive('/projects/abc', '/projects')).toBe(true);
    expect(isNavItemActive('/equipos/1/plan', '/equipos')).toBe(true);
    expect(isNavItemActive('/reports', '/dashboard')).toBe(false);
    expect(isNavItemActive('/dashboard', '/dashboard')).toBe(true);
  });
  it('etiquetas de rol', () => {
    expect(roleLabel(true, false)).toBe('Administrador');
    expect(roleLabel(false, true)).toBe('Líder de proyecto');
    expect(roleLabel(false, false)).toBe('Colaborador');
  });
});

describe('titleForPath', () => {
  it('título por ruta con el nombre de la app', () => {
    expect(titleForPath('/reports')).toBe('Reportes · Planner Fábrica');
    expect(titleForPath('/settings/')).toBe('Configuración · Planner Fábrica');
    expect(titleForPath('/equipos/e1/plan')).toBe('Plan semanal · Planner Fábrica');
  });
  it('el detalle de proyecto y las rutas desconocidas no se pisan', () => {
    expect(titleForPath('/projects/123')).toBeNull();
    expect(titleForPath('/nada')).toBeNull();
  });
});

const renderLayout = (path = '/reports') =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <AppLayout><div>contenido</div></AppLayout>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('AppLayout + AppSidebar', () => {
  it('un solo menú de cuenta (en el encabezado) con Perfil, Configuración y Cerrar sesión', () => {
    renderLayout();
    expect(screen.getAllByRole('button', { name: 'Menú de cuenta' })).toHaveLength(1);
    // el pie del sidebar es un enlace al perfil, no un menú desplegable
    const profileLink = screen.getByRole('link', { name: /Mi perfil: Ana Pérez/ });
    expect(profileLink).toHaveAttribute('href', '/profile');
    expect(profileLink).not.toHaveAttribute('aria-haspopup');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Menú de cuenta' }), { key: 'Enter' });
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Perfil')).toBeInTheDocument();
    expect(within(menu).getByText('Configuración')).toBeInTheDocument();
    expect(within(menu).getByText('Colaborador')).toBeInTheDocument();
    fireEvent.click(within(menu).getByText('Cerrar sesión'));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('la navegación principal es un <nav> con nombre y marca la página actual con aria-current', () => {
    auth.isProjectLeader = true;
    renderLayout('/reports');
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(within(nav).getByRole('link', { name: 'Reportes' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Equipos' })).not.toHaveAttribute('aria-current');
  });

  it('colaborador: sin opciones de gestión; líder: con ellas', () => {
    const a = renderLayout();
    expect(screen.queryByRole('link', { name: 'Reportes' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configuración' })).toBeInTheDocument();
    a.unmount();
    auth.isProjectLeader = true;
    renderLayout();
    expect(screen.getByRole('link', { name: 'Reportes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registro de Entregas' })).toBeInTheDocument();
  });

  it('el encabezado ya no duplica el acceso a Proyectos; la campana es un enlace con contador accesible', () => {
    unread.n = 3;
    renderLayout('/dashboard');
    const header = screen.getByRole('banner');
    expect(within(header).queryByRole('link', { name: 'Proyectos' })).not.toBeInTheDocument();
    const bell = within(header).getByRole('link', { name: 'Notificaciones (3 sin leer)' });
    expect(bell).toHaveAttribute('href', '/notifications');
    // sin elementos interactivos anidados: ningún <button> dentro del <a>
    expect(bell.querySelector('button')).toBeNull();
  });

  it('el contador del sidebar se anuncia a lector de pantalla', () => {
    unread.n = 12;
    renderLayout('/dashboard');
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(within(nav).getByRole('link', { name: /Notificaciones.*12 sin leer/ })).toBeInTheDocument();
  });

  it('«Saltar al contenido» mueve el foco al <main>', () => {
    renderLayout();
    fireEvent.click(screen.getByRole('button', { name: 'Saltar al contenido' }));
    expect(screen.getByRole('main')).toHaveFocus();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('fija el título de la pestaña según la ruta', () => {
    renderLayout('/calendar');
    expect(document.title).toBe('Calendario · Planner Fábrica');
  });
});
