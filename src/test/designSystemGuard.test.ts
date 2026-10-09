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
  it('no quedan window.confirm ni window.prompt (se usan ConfirmDialog y NameDialog)', () => {
    expect(offenders(/(?<![\w.])(?:window\.)?(?:confirm|prompt)\(/, (p) => p.includes('components/shared/ConfirmDialog') || p.includes('components/shared/NameDialog'))).toEqual([]);
  });

  it('todo <Button size="icon"> tiene nombre accesible (aria-label)', () => {
    const missing: string[] = [];
    for (const p of sources.filter((f) => f.endsWith('.tsx') && !f.includes('components/ui/'))) {
      const src = read(p);
      for (const m of src.matchAll(/<Button/g)) {
        let depth = 0;
        let quote = '';
        let end = -1;
        for (let j = m.index!; j < src.length; j++) {
          const c = src[j];
          if (quote) { if (c === quote && src.charCodeAt(j - 1) !== 92) quote = ''; continue; }
          if (depth === 0 && (c === '"' || c === "'")) { quote = c; continue; }
          if (c === '{') depth++;
          else if (c === '}') depth--;
          else if (depth > 0 && (c === '`' || c === '"' || c === "'")) { j = src.indexOf(c, j + 1); }
          else if (c === '>' && depth === 0 && src[j - 1] !== '=') { end = j; break; }
        }
        const tag = src.slice(m.index!, end + 1);
        if (tag.includes('size="icon"') && !tag.includes('aria-label')) missing.push(`${p}:${src.slice(0, m.index).split(String.fromCharCode(10)).length}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('accesibilidad: sin elementos interactivos anidados', () => {
  it('ningún <Link> contiene directamente un <Button> (se usa <Button asChild><Link/></Button>)', () => {
    const nested = sources.filter((p) => p.endsWith('.tsx') && /<Link\b[^>]*>\s*<Button\b/.test(read(p)));
    expect(nested).toEqual([]);
  });
});

describe('accesibilidad: foco visible', () => {
  it('los anillos de foco no usan tintes de baja opacidad (ring-primary/30, ring-white/50)', () => {
    expect(offenders(/focus(?:-visible|-within)?:ring-(?:primary\/30|white\/50)/)).toEqual([]);
  });
});

describe('estados de carga: sin spinners de página completa', () => {
  it('solo quedan los de autenticación/redirección y el LoadingState compartido', () => {
    const allowed = ['components/layout/AppLayout.tsx', 'pages/GoogleAuthSuccess.tsx', 'components/shared/StoryUI.tsx'];
    const bad = offenders(/Loader2 className="h-8 w-8 animate-spin/, (p) => allowed.some((a) => p.endsWith(a)));
    expect(bad).toEqual([]);
  });
});
