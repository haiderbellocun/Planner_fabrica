import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { TaskCard } from './TaskCard';

const task = {
  id: 't1', task_number: 7, title: 'Grabar video de bienvenida', description: null, priority: 'high', due_date: null,
  status: { id: 's1', name: 'En proceso', color: '#0DD9D0', is_completed: false }, assignee: null, epic: null, team: null,
} as never;

function Board({ onClick }: { onClick: () => void }) {
  return (
    <DragDropContext onDragEnd={() => {}}>
      <Droppable droppableId="col">
        {(p) => (
          <div ref={p.innerRef} {...p.droppableProps}>
            <Draggable draggableId="t1" index={0}>
              {(d) => (
                <div ref={d.innerRef} {...d.draggableProps} {...d.dragHandleProps} data-testid="handle">
                  <TaskCard task={task} projectKey="ALF" onClick={onClick} />
                </div>
              )}
            </Draggable>
            {p.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

describe('Kanban: abrir tareas con teclado sin romper el arrastre', () => {
  it('el asa de arrastre conserva su foco y rol (arrastre accesible de la librería)', () => {
    render(<Board onClick={vi.fn()} />);
    const handle = screen.getByTestId('handle');
    expect(handle).toHaveAttribute('tabindex', '0');
    expect(handle).toHaveAttribute('role', 'button');
    expect(handle).toHaveAttribute('aria-describedby');
  });
  it('el título es un botón con nombre accesible que abre la tarea una sola vez (Enter/clic)', () => {
    const open = vi.fn();
    render(<Board onClick={open} />);
    const btn = screen.getByRole('button', { name: 'Abrir tarea ALF-7: Grabar video de bienvenida' });
    fireEvent.click(btn);
    expect(open).toHaveBeenCalledTimes(1); // stopPropagation: no se dispara también el clic de la tarjeta
  });
  it('clic en la tarjeta (ratón) sigue abriendo la tarea', () => {
    const open = vi.fn();
    render(<Board onClick={open} />);
    fireEvent.click(screen.getByText('ALF-7'));
    expect(open).toHaveBeenCalledTimes(1);
  });
});
