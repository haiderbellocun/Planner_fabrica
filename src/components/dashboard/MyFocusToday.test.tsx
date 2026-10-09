import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const auth = { isAdmin: false, isProjectLeader: false };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

const status = (name: string, done = false) => ({ name, color: '#0DD9D0', is_completed: done });
const project = { id: 'pr1', name: 'Proyecto Alfa', key: 'ALF' };
const mine = [
  { id: 'm-future', title: 'Mi tarea futura', due_date: '2026-10-20', status: status('En proceso'), project },
  { id: 'm-over', title: 'Mi tarea vencida', due_date: '2026-10-01', status: status('En proceso'), project },
  { id: 'm-today', title: 'Mi tarea de hoy', due_date: '2026-10-09', status: status('En proceso'), project },
  { id: 'm-nostatus', title: 'Mi tarea sin estado', due_date: null, status: null, project },
  { id: 'm-done', title: 'Mi tarea terminada', due_date: '2026-10-02', status: status('Finalizado', true), project },
];
const team = [
  { id: 't-over', title: 'Tarea vencida del equipo', due_date: '2026-10-02', status: status('En proceso'),
    assignee: { full_name: 'Luis Gómez', email: 'l@cun.edu.co', cargo: 'Diseñador' }, project },
];

const data = { mine: mine as unknown[], team: team as unknown[], loading: false, error: false };
vi.mock('@/hooks/useTasks', () => ({
  useMyTasks: () => ({ tasks: data.mine, data: data.mine, isLoading: data.loading, isError: data.error, error: data.error ? new Error('fallo de red') : null }),
  useLeadersFocus: () => ({ data: data.team, isLoading: false, error: null }),
  useTask: () => ({ data: undefined }),
}));
vi.mock('@/hooks/useCapacity', () => ({ useMyCapacity: () => ({ data: undefined, isLoading: false }) }));
vi.mock('@/hooks/useReports', () => ({ useReportTeamCapacity: () => ({ data: { members: [] } }) }));
vi.mock('@/components/tasks/TaskDetailSheet', () => ({
  TaskDetailSheet: ({ open, projectKey }: { open: boolean; projectKey: string }) =>
    open ? <div data-testid="sheet">{projectKey}</div> : null,
}));

import { MyFocusToday } from './MyFocusToday';

const ui = () => <MemoryRouter><MyFocusToday /></MemoryRouter>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-09T17:00:00Z')); // viernes 12:00 en Bogotá
  auth.isAdmin = false; auth.isProjectLeader = false;
  data.mine = mine; data.team = team; data.loading = false; data.error = false;
});
afterEach(() => vi.useRealTimers());

describe('MyFocusToday', () => {
  it('colaborador: sin pestaña de equipo; prioritarias = propias, vencida primero; una tarea sin estado no rompe la vista', () => {
    render(ui());
    expect(screen.queryByText('Foco del equipo')).not.toBeInTheDocument();
    const items = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    const order = ['Mi tarea vencida', 'Mi tarea de hoy'].map((t) => items.findIndex((x) => x.includes(t)));
    expect(order[0]).toBeGreaterThan(-1);
    expect(order[0]).toBeLessThan(order[1]);
    expect(screen.getByText('Mi tarea sin estado')).toBeInTheDocument();
    expect(screen.queryByText('Mi tarea terminada')).not.toBeInTheDocument();
  });

  for (const role of ['isAdmin', 'isProjectLeader'] as const) {
    it(`${role}: «Mi foco» lista solo tareas propias y «Foco del equipo» conserva la tarea del equipo, abrible`, () => {
      auth[role] = true;
      render(ui());
      expect(screen.getByText('Mi foco')).toBeInTheDocument();
      expect(screen.getByText('Mi tarea vencida')).toBeInTheDocument();
      expect(screen.queryByText('Tarea vencida del equipo')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Foco del equipo'));
      const teamTask = screen.getAllByText('Tarea vencida del equipo')[0];
      expect(teamTask).toBeInTheDocument();
      fireEvent.click(teamTask);
      expect(screen.getByTestId('sheet')).toHaveTextContent('ALF');

      fireEvent.click(screen.getByText('Mi foco'));
      expect(screen.getByText('Mi tarea vencida')).toBeInTheDocument();
    });
  }

  const tiles = () => Object.fromEntries(
    Array.from(document.querySelectorAll<HTMLElement>('.stat-tile')).map((el) => {
      const label = el.querySelector('.stat-tile-label')?.textContent ?? '';
      const value = el.querySelector('.stat-tile-value')?.textContent ?? '';
      return [label, value];
    }),
  );

  const roles: ['colaborador' | 'líder' | 'admin', () => void][] = [
    ['colaborador', () => {}],
    ['líder', () => { auth.isProjectLeader = true; }],
    ['admin', () => { auth.isAdmin = true; }],
  ];

  for (const [name, setup] of roles) {
    it(`${name}: «Mi foco» calcula las 4 cifras solo con SUS tareas (1 hoy, 1 vencida, 4 en curso, 1 esta semana)`, () => {
      setup();
      render(ui());
      expect(tiles()).toMatchObject({ 'Vencen hoy': '1', Vencidas: '1', 'En curso': '4', 'Esta semana': '1' });
    });
  }

  for (const [name, setup] of roles.slice(1)) {
    it(`${name}: «Foco del equipo» muestra cifras del equipo, rotuladas como tal, y no las propias`, () => {
      setup();
      render(ui());
      fireEvent.click(screen.getByText('Foco del equipo'));
      expect(tiles()).toMatchObject({
        'Vencen hoy (equipo)': '0', 'Vencidas (equipo)': '1', 'Pendientes de revisión': '0', 'Esta semana (equipo)': '0',
      });
      fireEvent.click(screen.getByText('Mi foco'));
      expect(tiles()).toMatchObject({ 'Vencen hoy': '1', Vencidas: '1' });
    });
  }

  it('las cifras personales no cambian aunque el equipo tenga muchas más tareas vencidas', () => {
    data.team = Array.from({ length: 12 }, (_, i) => ({ ...team[0], id: `t${i}` }));
    auth.isProjectLeader = true;
    render(ui());
    expect(tiles().Vencidas).toBe('1');
    fireEvent.click(screen.getByText('Foco del equipo'));
    expect(tiles()['Vencidas (equipo)']).toBe('12');
  });

  it('sin tareas propias: mensaje vacío y cifras en 0 (el equipo no se filtra a la vista personal)', () => {
    data.mine = [];
    auth.isProjectLeader = true;
    render(ui());
    expect(screen.getByText('No tienes tareas asignadas.')).toBeInTheDocument();
    expect(tiles()).toMatchObject({ 'Vencen hoy': '0', Vencidas: '0', 'En curso': '0', 'Esta semana': '0' });
  });

  it('sin tareas del equipo: mensaje vacío en el equipo y la vista personal intacta', () => {
    data.team = [];
    auth.isAdmin = true;
    render(ui());
    expect(tiles().Vencidas).toBe('1');
    fireEvent.click(screen.getByText('Foco del equipo'));
    expect(screen.getByText('Sin tareas del equipo por vencer.')).toBeInTheDocument();
  });

  it('datos incompletos (sin fecha, sin estado, fecha inválida) no rompen ninguna vista', () => {
    data.mine = [
      { id: 'x1', title: 'Sin nada', due_date: null, status: null, project },
      { id: 'x2', title: 'Fecha rara', due_date: 'no-es-fecha', status: status('En proceso'), project },
    ];
    data.team = [{ id: 'y1', title: 'Equipo incompleto', due_date: undefined, status: null, assignee: { full_name: null, email: null, cargo: null }, project }];
    auth.isProjectLeader = true;
    expect(() => render(ui())).not.toThrow();
    expect(tiles()['En curso']).toBe('2');
    expect(() => fireEvent.click(screen.getByText('Foco del equipo'))).not.toThrow();
  });

  it('carga, error y vacío son estados distintos de «Mi foco»', () => {
    data.loading = true; data.mine = [];
    const a = render(ui());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('No tienes tareas asignadas.')).not.toBeInTheDocument();
    a.unmount();

    data.loading = false; data.error = true;
    const b = render(ui());
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('No tienes tareas asignadas.')).not.toBeInTheDocument();
    b.unmount();

    data.error = false; data.mine = [];
    render(ui());
    expect(screen.getByText('No tienes tareas asignadas.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('el selector expone roles de pestañas y aria-selected, y solo existe para líder/admin', () => {
    const a = render(ui());
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    a.unmount();
    auth.isProjectLeader = true;
    render(ui());
    expect(screen.getByRole('tablist', { name: 'Vista del foco' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Mi foco' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Foco del equipo' }));
    expect(screen.getByRole('tab', { name: 'Foco del equipo' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Mi foco' })).toHaveAttribute('aria-selected', 'false');
  });
});
