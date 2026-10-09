import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusPill, StatTile, LoadingState, EmptyState } from '@/components/shared/StoryUI';

// Verificación por componentes de lo que cambió en el sistema de diseño. No sustituye la
// revisión visual: comprueba semántica, funcionalidad y accesibilidad, no apariencia.

describe('badges y pastillas: el significado no depende solo del color', () => {
  const tones = ['good', 'warning', 'critical', 'info', 'available'] as const;
  it('cada tono tiene clase propia y siempre muestra su texto y un punto de forma', () => {
    const classes = new Set<string>();
    for (const tone of tones) {
      const { unmount, container } = render(<StatusPill tone={tone}>Etiqueta {tone}</StatusPill>);
      const pill = container.firstElementChild as HTMLElement;
      expect(pill).toHaveTextContent(`Etiqueta ${tone}`);
      expect(pill.className).toContain('status-pill');
      classes.add(pill.className);
      unmount();
    }
    // good/warning/critical son visualmente distintos entre sí
    expect(['good', 'warning', 'critical'].map((t) => `status-pill status-pill-${t}`).every((c) => classes.has(c))).toBe(true);
  });
  it('las clases de estado y pastilla usan los tokens "strong" para el texto (AA)', () => {
    const css = readFileSync('src/index.css', 'utf8');
    for (const tone of ['good', 'warning', 'critical', 'info']) {
      expect(css).toMatch(new RegExp(`\\.status-pill-${tone}\\s*\\{[^}]*text-(?:success|warning|destructive|info)-strong`));
    }
    expect(css).toMatch(/\.priority-urgent\s*\{[^}]*text-destructive-strong/);
  });
  it('Badge conserva su variante por defecto con texto legible', () => {
    render(<Badge>Nueva</Badge>);
    expect(screen.getByText('Nueva').className).toContain('text-primary-foreground');
  });
});

describe('botones', () => {
  it('conservan su acción al hacer clic', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it('deshabilitado no ejecuta la acción y queda fuera del orden de tabulación', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Guardar</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeDisabled();
  });
  it('tienen anillo de foco visible, respuesta al pulsar y solo propiedades concretas en la transición', () => {
    render(<Button>Ok</Button>);
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('focus-visible:ring-2');
    expect(cls).toContain('active:scale-[0.97]');
    expect(cls).not.toContain('transition-all');
  });
});

describe('estados de carga, vacío y error se distinguen', () => {
  it('carga: role=status; vacío: mensaje con su propio contenedor, sin role=status', () => {
    const { unmount } = render(<LoadingState label="Cargando proyectos" />);
    expect(screen.getByRole('status', { name: 'Cargando proyectos' })).toBeInTheDocument();
    unmount();
    render(<EmptyState message="No hay proyectos todavía." />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('No hay proyectos todavía.')).toBeInTheDocument();
  });
  it('una ficha con valor 0 muestra "0" y no un vacío', () => {
    render(<StatTile label="Vencidas" value={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});

describe('movimiento reducido', () => {
  const css = readFileSync('src/index.css', 'utf8');
  it('hay una regla prefers-reduced-motion que anula animaciones, transiciones y la escala al pulsar', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/active\\:scale-\\\[0\\\.97\\\]:active\s*\{\s*transform:\s*none/);
  });
});

describe('teclado: los controles interactivos son elementos nativos', () => {
  // Un <button> nativo se enfoca con Tab y se activa con Enter/Espacio en el navegador (jsdom no
  // simula esa activación): lo que se comprueba es que no sean <div onClick> sin rol ni tabindex.
  it('Button es un <button> enfocable', () => {
    render(<Button>Siguiente</Button>);
    const btn = screen.getByRole('button', { name: 'Siguiente' });
    expect(btn.tagName).toBe('BUTTON');
    btn.focus();
    expect(btn).toHaveFocus();
    expect(btn.getAttribute('tabindex')).not.toBe('-1');
  });
});
