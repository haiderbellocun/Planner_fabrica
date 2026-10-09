// Helpers de nombres seguros ante null/undefined, espacios repetidos y nombres de una sola palabra.
const words = (name: string | null | undefined): string[] =>
  (name ?? '').trim().split(/\s+/).filter(Boolean);

/** Iniciales de las dos primeras palabras (máx. 2 letras); 'U' si no hay nombre. */
export function getInitials(name: string | null | undefined): string {
  const w = words(name);
  if (w.length === 0) return 'U';
  return w.slice(0, 2).map((p) => Array.from(p)[0]).join('').toUpperCase();
}

/** Primera palabra del nombre, o `fallback` si no hay nombre. */
export function firstName(name: string | null | undefined, fallback = 'Sin nombre'): string {
  return words(name)[0] ?? fallback;
}

/** Hasta `count` primeras palabras, o `fallback` si no hay nombre. */
export function shortName(name: string | null | undefined, count = 2, fallback = 'Sin nombre'): string {
  const w = words(name);
  return w.length ? w.slice(0, count).join(' ') : fallback;
}
