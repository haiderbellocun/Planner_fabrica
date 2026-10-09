import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { activatable, activatableRow } from './a11y';

describe('activatable (tarjetas clicables accesibles)', () => {
  it('es enfocable, tiene role=button y se activa con clic, Enter y Espacio', () => {
    const go = vi.fn();
    render(<div {...activatable(go)} aria-label="Tarea 1">contenido</div>);
    const el = screen.getByRole('button', { name: 'Tarea 1' });
    expect(el).toHaveAttribute('tabindex', '0');
    fireEvent.click(el);
    fireEvent.keyDown(el, { key: 'Enter' });
    fireEvent.keyDown(el, { key: ' ' });
    expect(go).toHaveBeenCalledTimes(3);
  });
  it('otras teclas no activan', () => {
    const go = vi.fn();
    render(<div {...activatable(go)} aria-label="x">c</div>);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'a' });
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Tab' });
    expect(go).not.toHaveBeenCalled();
  });
  it('Enter en un botón interior no activa la tarjeta (solo el propio contenedor)', () => {
    const go = vi.fn();
    const inner = vi.fn();
    render(<div {...activatable(go)} aria-label="Tarjeta"><button onClick={inner}>Eliminar</button></div>);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Eliminar' }), { key: 'Enter' });
    expect(go).not.toHaveBeenCalled();
  });
});

describe('activatableRow (filas de tabla)', () => {
  it('conserva el rol de fila, es enfocable y activable por teclado', () => {
    const go = vi.fn();
    render(<table><tbody><tr {...activatableRow(go)}><td>Ana</td></tr></tbody></table>);
    const row = screen.getByRole('row');
    expect(row).toHaveAttribute('tabindex', '0');
    expect(row).not.toHaveAttribute('role');
    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.click(row);
    expect(go).toHaveBeenCalledTimes(2);
  });
});
