import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

// Comprobaciones ESTRUCTURALES de responsive (clases y metadatos). No miden píxeles: el
// desbordamiento real a 375 / 768 / 1440 px se valida en un navegador.
const read = (p: string) => readFileSync(p, 'utf8');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const tsx = walk('src').map((p) => p.split(sep).join('/')).filter((p) => p.endsWith('.tsx') && !p.includes('.test.'));

describe('metadatos móviles', () => {
  const html = read('index.html');
  it('idioma español, viewport con teclado que redimensiona y color de la barra', () => {
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('width=device-width');
    expect(html).toContain('interactive-widget=resizes-content');
    expect(html).toContain('name="theme-color"');
  });
  it('nunca se desactiva el zoom', () => {
    expect(html).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1\b/);
  });
});

describe('objetivos táctiles (≥ 44px en móvil)', () => {
  it('Button, Input y Select pasan a h-11 por debajo de md', () => {
    const btn = read('src/components/ui/button.tsx');
    expect(btn).toContain('icon: "h-11 w-11 md:h-10 md:w-10"');
    expect(btn).toContain('default: "h-11 md:h-10');
    expect(read('src/components/ui/input.tsx')).toContain('h-11 md:h-10');
    expect(read('src/components/ui/select.tsx')).toContain('h-11 md:h-10');
  });
  it('el sidebar tiene elementos de al menos 44px en móvil', () => {
    expect(read('src/components/layout/AppSidebar.tsx')).toContain('min-h-11');
  });
  it('inputs a 16px en móvil (sin zoom automático de iOS)', () => {
    const input = read('src/components/ui/input.tsx');
    expect(input).toContain('text-base');
    expect(input).toContain('md:text-sm');
    expect(input).toContain('focus-visible:ring-ring');
  });
});

describe('desbordamiento horizontal', () => {
  it('toda <table> propia va dentro de un contenedor con overflow', () => {
    const bad: string[] = [];
    for (const p of tsx.filter((f) => !f.includes('components/ui/'))) {
      const lines = read(p).split(String.fromCharCode(10));
      lines.forEach((l, i) => {
        if (l.includes('<table') && !/overflow-(x-)?auto/.test(lines.slice(Math.max(0, i - 4), i).join(' '))) bad.push(`${p}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });
  it('el calendario conserva todas sus celdas con desplazamiento horizontal (ancho mínimo)', () => {
    expect(read('src/pages/Calendar.tsx').match(/min-w-\[640px\]/g)?.length).toBeGreaterThanOrEqual(3);
  });
  it('las pestañas base no desbordan y los diálogos altos se desplazan por dentro', () => {
    expect(read('src/components/ui/tabs.tsx')).toContain('max-w-full');
    expect(read('src/components/ui/tabs.tsx')).toContain('overflow-x-auto');
    expect(read('src/components/ui/dialog.tsx')).toContain('max-h-[calc(100dvh-2rem)]');
  });
  it('el encabezado de la app permite que la búsqueda se encoja (min-w-0) y reduce huecos en pantallas estrechas', () => {
    const layout = read('src/components/layout/AppLayout.tsx');
    expect(layout).toContain('flex-1 min-w-0');
    expect(layout).toContain('gap-2 sm:gap-4');
  });
  it('el encabezado de página apila las acciones en móvil y las alinea en pantallas anchas', () => {
    expect(read('src/components/layout/PageHeader.tsx')).toContain('flex-col');
    expect(read('src/components/layout/PageHeader.tsx')).toContain('sm:flex-row');
  });
  it('las acciones de detalle de proyecto pueden pasar a otra línea', () => {
    expect(read('src/pages/ProjectDetail.tsx')).toContain('flex flex-wrap items-center gap-2');
  });
});

describe('base táctil', () => {
  it('sin parpadeo de toque ni retardo de clic', () => {
    const css = read('src/index.css');
    expect(css).toContain('-webkit-tap-highlight-color: transparent');
    expect(css).toContain('touch-action: manipulation');
    expect(css).toContain('100dvh');
  });
});
