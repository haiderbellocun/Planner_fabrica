export function parseDateOnly(date: string | null | undefined): Date | null {
  if (!date) return null;
  try {
    const datePart = date.slice(0, 10); // yyyy-MM-dd
    const [y, m, d] = datePart.split('-').map((n) => parseInt(n, 10));
    if (!y || !m || !d) return null;
    // Crear fecha local sin desfase de zona horaria
    return new Date(y, m - 1, d);
  } catch {
    return null;
  }
}

