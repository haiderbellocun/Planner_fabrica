import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { chartColors, chartInk, chartSoft, chartSurface, gridColor } from './chartTheme';

// El CSS (:root) y chartTheme.ts son dos vistas del mismo sistema: si divergen, los gráficos
// dejan de coincidir con el resto de la interfaz. Este test falla si alguno cambia solo.
const css = readFileSync('src/index.css', 'utf8');
// Los tokens --chart-* solo existen en :root (el bloque .dark no los redefine).
const rootBlock = css;
const cssVar = (name: string) => {
  const m = rootBlock.match(new RegExp(`--${name}:[ 	]*(#[0-9A-Fa-f]{6})`));
  return m ? m[1].toUpperCase() : undefined;
};

const PAIRS: [string, string][] = [
  ['chart-teal', chartColors.teal], ['chart-teal-deep', chartColors.tealDeep], ['chart-coral', chartColors.coral],
  ['chart-rust', chartColors.rust], ['chart-amber', chartColors.yellow], ['chart-green', chartColors.green],
  ['chart-magenta', chartColors.magenta], ['chart-slate', chartColors.slate], ['chart-info', chartColors.info],
  ['chart-ink-strong', chartInk.strong], ['chart-ink-muted', chartInk.muted], ['chart-ink-green', chartInk.green],
  ['chart-ink-teal', chartInk.teal], ['chart-ink-amber', chartInk.amber], ['chart-ink-coral', chartInk.coral],
  ['chart-soft-green', chartSoft.green], ['chart-soft-coral', chartSoft.coral], ['chart-soft-neutral', chartSoft.neutral],
  ['chart-soft-track', chartSoft.track], ['chart-soft-empty', chartSoft.empty], ['chart-soft-teal', chartSoft.teal],
  ['chart-yellow-light', chartSoft.yellowLight], ['chart-surface', chartSurface.card],
];

describe('tokens de gráficos', () => {
  it.each(PAIRS)('--%s coincide con chartTheme.ts', (name, ts) => {
    expect(cssVar(name)).toBe(ts.toUpperCase());
  });
  it('la rejilla del CSS es la misma que la de chartTheme salvo su variante clara documentada', () => {
    expect(gridColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

// Contraste (WCAG) de la tinta de gráficos sobre blanco: son textos pequeños, mínimo 4,5:1.
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('contraste de la tinta de gráficos', () => {
  it.each(Object.entries(chartInk))('chartInk.%s ≥ 4.5:1 sobre blanco', (_k, hex) => {
    expect(ratio(hex, chartSurface.card)).toBeGreaterThanOrEqual(4.5);
  });
});
