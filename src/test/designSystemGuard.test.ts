import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

// Guardas de regresión del sistema de diseño: fallan si alguien reintroduce lo que se eliminó.
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const sources = walk('src')
  .map((p) => p.split(sep).join('/'))
  .filter((p) => /\.(tsx|css)$/.test(p) && !p.includes('.test.'));
const read = (p: string) => readFileSync(p, 'utf8');
const offenders = (re: RegExp, skip: (p: string) => boolean = () => false) =>
  sources.filter((p) => !skip(p) && re.test(read(p)));

describe('sistema de diseño: guardas', () => {
  it('no hay transition-all (salvo el riel interno de sidebar.tsx de shadcn)', () => {
    expect(offenders(/\btransition-all\b/, (p) => p.endsWith('components/ui/sidebar.tsx'))).toEqual([]);
  });
  it('no hay tamaños de fuente por debajo de 11px: se usa text-2xs como mínimo', () => {
    expect(offenders(/text-\[(?:[0-9]|10)(?:\.5)?px\]/)).toEqual([]);
  });
  it('no hay neutros fijos de Tailwind (gray/slate/zinc) en texto ni bordes', () => {
    expect(offenders(/\b(?:text|border)-(?:gray|slate|zinc)-\d{2,3}\b/)).toEqual([]);
  });
  it('las sombras son solo card y floating (sin shadow-sm/md/lg/xl ni rgba arbitrarios)', () => {
    expect(offenders(/\bshadow-(?:sm|md|lg|xl|2xl)\b|shadow-\[[^\]]*rgba/, (p) => p.endsWith('components/ui/sidebar.tsx'))).toEqual([]);
  });
  it('las etiquetas ya no usan uppercase (salvo componentes base de ui/)', () => {
    expect(offenders(/\buppercase\b/, (p) => p.includes('components/ui/'))).toEqual([]);
  });
});
