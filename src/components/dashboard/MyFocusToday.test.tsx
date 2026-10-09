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

vi.mock('@/hooks/useTasks', () => ({
  useMyTasks: () => ({ tasks: mine, data: mine, isLoading: false, isError: false, error: null }),
  useLeadersFocus: () => ({ data: team, isLoading: false, error: null }),
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
});
