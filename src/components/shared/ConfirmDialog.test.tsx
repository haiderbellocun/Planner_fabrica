import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useState } from 'react';
import { useConfirmDialog } from './ConfirmDialog';
import { NameDialog } from './NameDialog';

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.scrollIntoView = () => {};
});

function Harness({ action, destructive = true, description }: { action: () => void | Promise<unknown>; destructive?: boolean; description?: string }) {
  const { confirmAction, confirmDialog } = useConfirmDialog();
  return (
    <>
      <button onClick={() => confirmAction({
        title: '¿Eliminar el equipo "Diseño"?', description, confirmLabel: 'Eliminar', destructive, onConfirm: action,
      })}>Borrar</button>
      {confirmDialog}
    </>
  );
}

const open = () => fireEvent.click(screen.getByText('Borrar'));

describe('ConfirmDialog / useConfirmDialog', () => {
  it('es un alertdialog accesible con título y descripción de lo que se eliminará', () => {
    render(<Harness action={vi.fn()} description="Las tareas quedarán sin equipo." />);
    open();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('¿Eliminar el equipo "Diseño"?');
    expect(dialog).toHaveTextContent('Las tareas quedarán sin equipo.');
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('Cancelar cierra sin ejecutar la acción', async () => {
    const action = vi.fn();
    render(<Harness action={action} />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(action).not.toHaveBeenCalled();
  });

  it('Confirmar ejecuta la acción original una sola vez y cierra', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    render(<Harness action={action} />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('mientras la operación corre: queda abierto, bloquea confirmaciones repetidas, Cancelar y Esc', async () => {
    let finish!: () => void;
    const action = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<Harness action={action} />);
    open();
    const confirm = screen.getByRole('button', { name: 'Eliminar' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Eliminar/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Eliminar/ })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await act(async () => { finish(); });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('si la acción falla: queda abierto con el motivo visible, «Reintentar» y se puede reintentar o cancelar', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const action = vi.fn().mockRejectedValueOnce(new Error('Sin permiso (403)')).mockResolvedValueOnce(undefined);
    render(<Harness action={action} />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Sin permiso (403)');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
    // reintento seguro: ejecuta de nuevo UNA vez, tiene éxito y cierra
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(action).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it('tras un fallo, Cancelar cierra sin reejecutar y al volver a abrir no queda el error anterior', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const action = vi.fn().mockRejectedValue(new Error('boom'));
    render(<Harness action={action} />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(action).toHaveBeenCalledTimes(1);
    open();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    spy.mockRestore();
  });

  it('acción destructiva usa el estilo destructivo; la no destructiva, no', () => {
    const a = render(<Harness action={vi.fn()} destructive />);
    open();
    expect(screen.getByRole('button', { name: 'Eliminar' }).className).toContain('bg-destructive');
    a.unmount();
    render(<Harness action={vi.fn()} destructive={false} />);
    open();
    expect(screen.getByRole('button', { name: 'Eliminar' }).className).not.toContain('bg-destructive');
  });
});

describe('NameDialog (reemplazo de prompt)', () => {
  function Host({ onSubmit, initial = '' }: { onSubmit: (n: string) => void; initial?: string }) {
    const [open, setOpen] = useState(true);
    return <NameDialog open={open} onOpenChange={setOpen} title="Guardar vista" label="Nombre de la vista" initialValue={initial} onSubmit={onSubmit} />;
  }
  it('no permite guardar un nombre vacío o solo con espacios', () => {
    const onSubmit = vi.fn();
    render(<Host onSubmit={onSubmit} />);
    const save = screen.getByRole('button', { name: 'Guardar' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Nombre de la vista'), { target: { value: '   ' } });
    expect(save).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('envía el nombre recortado y cierra', async () => {
    const onSubmit = vi.fn();
    render(<Host onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Nombre de la vista'), { target: { value: '  Mis urgentes ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenCalledWith('Mis urgentes');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('al renombrar, parte del nombre actual', () => {
    render(<Host onSubmit={vi.fn()} initial="Vista A" />);
    expect(screen.getByLabelText('Nombre de la vista')).toHaveValue('Vista A');
  });
});
