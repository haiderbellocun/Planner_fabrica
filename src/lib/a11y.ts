import type { KeyboardEvent } from 'react';

// Contenedores clicables que no pueden ser <button> (filas de tabla, tarjetas con controles
// anidados). Añaden foco por teclado y activación con Enter/Espacio solo cuando el evento
// proviene del propio contenedor (no de un botón, enlace o campo interior).
function onActivateKey(onActivate: () => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate();
    }
  };
}

/** Tarjeta/contenedor: role="button" enfocable. */
export function activatable(onActivate: () => void) {
  return { role: 'button' as const, tabIndex: 0, onClick: onActivate, onKeyDown: onActivateKey(onActivate) };
}

/** Fila de tabla: conserva su rol de fila (no se le impone role="button"), pero es enfocable y activable. */
export function activatableRow(onActivate: () => void) {
  return { tabIndex: 0, onClick: onActivate, onKeyDown: onActivateKey(onActivate) };
}
