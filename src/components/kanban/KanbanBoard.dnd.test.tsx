import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const move = vi.fn();
vi.mock('./TaskCard', () => ({
  TaskCard: ({ task, onClick }: { task: { title: string }; onClick: () => void }) => <button onClick={onClick}>{task.title}</button>,
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
const statuses = [
  { id: 's1', name: 'Sin iniciar', color: '#999' },
  { id: 's2', name: 'En proceso', color: '#0DD' },
];
vi.mock('@/hooks/useTasks', () => ({
  useTaskStatuses: () => ({ data: statuses, isLoading: false }),
  useUpdateTaskStatus: () => ({ mutate: move }),
  useUpdateTaskRank: () => ({ mutate: move }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { KanbanBoard } from './KanbanBoard';

beforeAll(() => {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

const mk = (id: string, status_id: string, rank: number) => ({
  id, title: `Tarea ${id}`, status_id, board_rank: rank, created_at: '2026-10-01T00:00:00Z',
  status: statuses.find((s) => s.id === status_id)!, task_number: 1, project_id: 'p1',
}) as never;

describe('Kanban: arrastre con teclado (librería) sigue operativo tras la memoización', () => {
  it('cada tarjeta expone su asa enfocable con instrucciones de arrastre por teclado', () => {
    render(<KanbanBoard tasks={[mk('a', 's1', 1), mk('b', 's1', 2)]} projectKey="ALF" projectId="p1" onTaskClick={vi.fn()} />);
    const handles = document.querySelectorAll('[data-rfd-drag-handle-draggable-id]');
    expect(handles).toHaveLength(2);
    handles.forEach((h) => {
      expect(h).toHaveAttribute('tabindex', '0');
      expect(h.getAttribute('aria-describedby')).toBeTruthy();
    });
  });

  it('Espacio levanta la tarjeta (estado de arrastre) y Escape la devuelve sin cambios', async () => {
    render(<KanbanBoard tasks={[mk('a', 's1', 1), mk('b', 's1', 2)]} projectKey="ALF" projectId="p1" onTaskClick={vi.fn()} />);
    const handle = document.querySelector('[data-rfd-drag-handle-draggable-id="a"]') as HTMLElement;
    handle.focus();
    await act(async () => { fireEvent.keyDown(handle, { key: ' ', keyCode: 32, code: 'Space' }); });
    // al levantar, la librería marca la tarjeta como arrastrada y la saca a un portal (document.body)
    expect(document.body.querySelector('[data-rfd-dragging], [data-rfd-draggable-id="a"]')).not.toBeNull();
    await act(async () => { fireEvent.keyDown(window, { key: 'Escape', keyCode: 27, code: 'Escape' }); });
    expect(move).not.toHaveBeenCalled();
    expect(screen.getByText('Tarea a')).toBeInTheDocument();
  });
});
