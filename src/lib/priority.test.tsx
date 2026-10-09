import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { priorityConfig, getPriority, PRIORITY_LABELS } from './priority';
import { BADGE_TONES } from './badgeColors';
import { PROJECT_STATUS_BADGES } from './projectStatus';
import { PriorityBadge, StatusBadge, TaskStatusBadge } from '@/components/shared/StatusBadge';

describe('prioridad: una sola fuente', () => {
  it('conserva valores almacenados, etiquetas y orden de gravedad', () => {
    expect(Object.keys(priorityConfig)).toEqual(['low', 'medium', 'high', 'urgent']);
    expect(PRIORITY_LABELS).toEqual({ low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' });
    const ranks = Object.values(priorityConfig).map((p) => p.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
  it('cada prioridad tiene un tono distinto (alta se distingue de media y de urgente)', () => {
    const tones = Object.values(priorityConfig).map((p) => p.className);
    expect(new Set(tones).size).toBe(4);
  });
  it('valores desconocidos o vacíos caen en "media" sin romper', () => {
    expect(getPriority(undefined).label).toBe('Media');
    expect(getPriority(null).label).toBe('Media');
    expect(getPriority('otra').label).toBe('Media');
  });
});

describe('componentes de estado', () => {
  it('PriorityBadge muestra la etiqueta y usa el tono de su prioridad', () => {
    render(<PriorityBadge priority="urgent" />);
    const el = screen.getByText('Urgente');
    expect(el.className).toContain(priorityConfig.urgent.className);
  });
  it('StatusBadge aplica el tono pedido', () => {
    render(<StatusBadge tone="success">Aceptado</StatusBadge>);
    expect(screen.getByText('Aceptado').className).toContain(BADGE_TONES.success);
  });
  it('TaskStatusBadge: punto de color + texto del sistema; sin estado no se rompe', () => {
    const { container, rerender } = render(<TaskStatusBadge name="En proceso" color="#E8A317" />);
    expect(screen.getByText('En proceso').className).toContain('text-foreground');
    expect((container.querySelector('[aria-hidden="true"]') as HTMLElement).style.backgroundColor).not.toBe('');
    rerender(<TaskStatusBadge name={null} color={null} />);
    expect(screen.getByText('Sin estado')).toBeInTheDocument();
  });
});

// Contraste real: texto "strong" sobre el tinte del token sobre blanco (>= 4.5:1).
const css = readFileSync('src/index.css', 'utf8');
const hslOf = (name: string): [number, number, number] => {
  const m = css.match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`));
  if (!m) throw new Error(`token --${name} no encontrado`);
  return [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100];
};
const toRgb = ([h, s, l]: [number, number, number]) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
};
const lum = (c: number[]) => {
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (fg: number[], bg: number[]) => {
  const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('contraste de las insignias de estado', () => {
  const parse = (cls: string) => {
    const bg = cls.match(/bg-([a-z-]+)(?:\/(\d+))?/)!;
    const fg = cls.match(/text-([a-z-]+)/)![1];
    return { bgToken: bg[1], alpha: bg[2] ? Number(bg[2]) / 100 : 1, fgToken: fg };
  };
  const tokenRgb = (t: string) => {
    const map: Record<string, string> = { muted: 'muted', 'muted-foreground': 'muted-foreground', 'primary-deep': 'primary-deep' };
    return toRgb(hslOf(map[t] ?? t));
  };
  it.each(Object.entries(BADGE_TONES))('%s: texto sobre su tinte cumple AA', (_tone, cls) => {
    const { bgToken, alpha, fgToken } = parse(cls);
    const base = tokenRgb(bgToken);
    const bg = base.map((v) => v * alpha + 1 * (1 - alpha));
    expect(ratio(tokenRgb(fgToken), bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('el estado de proyecto pausado/finalizado también', () => {
    for (const { className } of Object.values(PROJECT_STATUS_BADGES)) {
      const { bgToken, alpha, fgToken } = parse(className);
      const bg = tokenRgb(bgToken).map((v) => v * alpha + (1 - alpha));
      expect(ratio(tokenRgb(fgToken), bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
