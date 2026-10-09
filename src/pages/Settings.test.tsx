import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const auth = { isAdmin: true, isProjectLeader: false, isLoading: false };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/useReports', () => ({
  useReportTeamCapacity: () => ({ data: { members: [], schedule: { weekly_hours: 38 } }, isLoading: false }),
}));
const mutateAsync = vi.fn();
vi.mock('@/hooks/useAdminUsers', () => ({
  useAdminUsers: (enabled: boolean) => ({ data: enabled ? [] : [], isLoading: false }),
  useCreateAdminUser: () => ({ mutateAsync, isPending: false }),
  useToggleUserActive: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/api', () => ({ api: { patch: vi.fn() }, apiBaseUrl: '' }));

import SettingsPage from './Settings';

const ui = () => (
  <QueryClientProvider client={new QueryClient()}>
    <SettingsPage />
  </QueryClientProvider>
);

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue({});
  auth.isAdmin = true; auth.isProjectLeader = false;
});

describe('Configuración: formulario de usuario nuevo', () => {
  it('cada campo tiene su etiqueta asociada (accesible por nombre)', () => {
    render(ui());
    expect(screen.getByLabelText('Nombre completo *')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo *')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña inicial *')).toBeInTheDocument();
  });

  it('el botón se habilita con los datos mínimos y guarda con el mismo payload de siempre', async () => {
    render(ui());
    const create = screen.getByRole('button', { name: /Crear usuario/ });
    expect(create).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Nombre completo *'), { target: { value: '  Ana Pérez ' } });
    fireEvent.change(screen.getByLabelText('Correo *'), { target: { value: 'ana@cun.edu.co' } });
    fireEvent.change(screen.getByLabelText('Contraseña inicial *'), { target: { value: 'secreta' } });
    expect(create).toBeEnabled();
    fireEvent.click(create);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({
      full_name: 'Ana Pérez', email: 'ana@cun.edu.co', password: 'secreta', cargo: null, role: 'user',
    });
    // el formulario se limpia tras guardar
    await waitFor(() => expect(screen.getByLabelText('Nombre completo *')).toHaveValue(''));
  });

  it('un correo inválido marca el campo y mantiene el botón deshabilitado', () => {
    render(ui());
    const email = screen.getByLabelText('Correo *');
    fireEvent.change(screen.getByLabelText('Nombre completo *'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Contraseña inicial *'), { target: { value: 'secreta' } });
    fireEvent.change(email, { target: { value: 'sin-arroba' } });
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: /Crear usuario/ })).toBeDisabled();
  });

  it('si el servidor rechaza, el formulario conserva lo escrito', async () => {
    mutateAsync.mockRejectedValueOnce(new Error('Ya existe un usuario con ese correo'));
    render(ui());
    fireEvent.change(screen.getByLabelText('Nombre completo *'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Correo *'), { target: { value: 'ana@cun.edu.co' } });
    fireEvent.change(screen.getByLabelText('Contraseña inicial *'), { target: { value: 'secreta' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear usuario/ }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(screen.getByLabelText('Correo *')).toHaveValue('ana@cun.edu.co');
  });

  it('un colaborador no ve el formulario de creación', () => {
    auth.isAdmin = false; auth.isProjectLeader = false;
    render(ui());
    expect(screen.queryByLabelText('Nombre completo *')).not.toBeInTheDocument();
  });

  it('un líder crea usuarios pero no ve el selector de rol (solo admin asigna roles)', () => {
    auth.isAdmin = false; auth.isProjectLeader = true;
    render(ui());
    expect(screen.getByLabelText('Nombre completo *')).toBeInTheDocument();
    expect(screen.queryByLabelText('Rol')).not.toBeInTheDocument();
  });
});
