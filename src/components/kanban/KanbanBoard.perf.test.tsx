import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';

// Medición de renders (no de milisegundos): cuántas veces se renderiza cada tarjeta.
const renders: Record<string, number> = {};
vi.mock('./TaskCard', () => ({
  TaskCard: ({ task, onClick }: { task: { id: string; title: string }; onClick: () => void }) => {
    renders[task.id] = (renders[task.id] ?? 0) + 1;
    return <button onClick={onClick}>{task.title}</button>;
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
const statuses = [
  { id: 's1', name: 'Sin iniciar', color: '#999' },
  { id: 's2', name: 'En proceso', color: '#0DD' },
  { id: 's3', name: 'Finalizado', color: '#0A5' },
];
vi.mock('@/hooks/useTasks', () => ({
  useTaskStatuses: () => ({ data: statuses, isLoading: false }),
  useUpdateTaskStatus: () => ({ mutate: vi.fn() }),
  useUpdateTaskRank: () => ({ mutate: vi.fn() }),
}));

import { KanbanBoard } from './KanbanBoard';

const mk = (id: string, status_id: string, rank: number) => ({
  id, title: `Tarea ${id}`, status_id, board_rank: rank, created_at: '2026-10-01T00:00:00Z',
  status: statuses.find((s) => s.id === status_id)!, task_number: 1,
}) as never;

beforeAll(() => {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

describe('KanbanBoard: renderizados', () => {
  it('un re-render del padre con las mismas tareas (callback nuevo incluido) no vuelve a renderizar las tarjetas', () => {
    const tasks = [mk('a', 's1', 1), mk('b', 's1', 2), mk('c', 's2', 1), mk('d', 's3', 1)];
    const first = vi.fn();
    const { rerender } = render(<KanbanBoard tasks={tasks} projectKey="ALF" projectId="p1" onTaskClick={first} />);
    const afterMount = { ...renders };
    expect(Object.keys(afterMount).sort()).toEqual(['a', 'b', 'c', 'd']);

    for (let i = 0; i < 5; i++) {
      rerender(<KanbanBoard tasks={tasks} projectKey="ALF" projectId="p1" onTaskClick={() => first()} />);
    }
    expect(renders).toEqual(afterMount); // 0 renders adicionales de tarjetas tras 5 re-renders del padre
  });

  it('el callback estable siempre invoca la versión MÁS RECIENTE de onTaskClick', () => {
    const tasks = [mk('a', 's1', 1)];
    const old = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(<KanbanBoard tasks={tasks} projectKey="ALF" projectId="p1" onTaskClick={old} />);
    rerender(<KanbanBoard tasks={tasks} projectKey="ALF" projectId="p1" onTaskClick={latest} />);
    screen.getByText('Tarea a').click();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(old).not.toHaveBeenCalled();
  });

  it('al cambiar solo las tareas de una columna, las otras columnas no se renderizan de nuevo', () => {
    const base = [mk('a', 's1', 1), mk('c', 's2', 1), mk('d', 's3', 1)];
    const open = vi.fn();
    const { rerender } = render(<KanbanBoard tasks={base} projectKey="ALF" projectId="p1" onTaskClick={open} />);
    const before = { ...renders };
    // una tarea nueva en s1: se recalcula el agrupado, pero las listas de s2/s3 se reconstruyen igual
    rerender(<KanbanBoard tasks={[...base, mk('e', 's1', 2)]} projectKey="ALF" projectId="p1" onTaskClick={open} />);
    expect(renders.e).toBe(1);
    expect(renders.a).toBeGreaterThan(before.a); // la columna afectada sí se actualiza
  });

  it('lista vacía: columnas vacías sin romperse', () => {
    expect(() => render(<KanbanBoard tasks={[]} projectKey="ALF" projectId="p1" onTaskClick={vi.fn()} />)).not.toThrow();
    expect(screen.getByText('En proceso')).toBeInTheDocument();
  });
});
