import { describe, it, expect } from 'vitest';
import { getBusinessTodayStr, getDueBucket, isWithinDays } from './dueDate';

describe('getDueBucket', () => {
  const today = '2026-03-15';

  it('marca como vencida una fecha de ayer, tarea no finalizada', () => {
    expect(getDueBucket('2026-03-14', false, today)).toBe('overdue');
  });

  it('marca como "vence hoy" una fecha igual a hoy', () => {
    expect(getDueBucket('2026-03-15', false, today)).toBe('due_today');
  });

  it('marca como próxima una fecha de mañana', () => {
    expect(getDueBucket('2026-03-16', false, today)).toBe('upcoming');
  });

  it('cambio de mes: 31 de marzo es "próxima" visto desde el 15 de marzo, y "vencida" vista desde el 1 de abril', () => {
    expect(getDueBucket('2026-03-31', false, today)).toBe('upcoming');
    expect(getDueBucket('2026-03-31', false, '2026-04-01')).toBe('overdue');
  });

  it('cambio de año: 31 de diciembre vencida vista desde el 1 de enero del año siguiente', () => {
    expect(getDueBucket('2025-12-31', false, '2026-01-01')).toBe('overdue');
    expect(getDueBucket('2026-01-01', false, '2025-12-31')).toBe('upcoming');
  });

  it('una tarea finalizada nunca se marca como vencida ni "vence hoy", aunque su fecha ya pasó o es hoy', () => {
    expect(getDueBucket('2026-03-01', true, today)).toBe('none');
    expect(getDueBucket('2026-03-15', true, today)).toBe('none');
  });

  it('sin fecha límite nunca es vencida', () => {
    expect(getDueBucket(null, false, today)).toBe('none');
    expect(getDueBucket(undefined, false, today)).toBe('none');
    expect(getDueBucket('', false, today)).toBe('none');
  });

  it('acepta fechas con componente de hora (timestamptz) usando solo la parte de fecha', () => {
    expect(getDueBucket('2026-03-14T23:59:59.000Z', false, today)).toBe('overdue');
    expect(getDueBucket('2026-03-15T00:00:00.000Z', false, today)).toBe('due_today');
  });
});

describe('isWithinDays', () => {
  const today = '2026-03-15';

  it('excluye hoy y el pasado', () => {
    expect(isWithinDays('2026-03-15', 7, today)).toBe(false);
    expect(isWithinDays('2026-03-14', 7, today)).toBe(false);
  });

  it('incluye una fecha dentro de la ventana', () => {
    expect(isWithinDays('2026-03-20', 7, today)).toBe(true);
    expect(isWithinDays('2026-03-22', 7, today)).toBe(true);
  });

  it('excluye una fecha fuera de la ventana', () => {
    expect(isWithinDays('2026-03-23', 7, today)).toBe(false);
  });

  it('funciona a través de un cambio de mes', () => {
    // Desde el 28 de febrero de 2026 (no bisiesto), +7 días cae en el 7 de marzo
    expect(isWithinDays('2026-03-07', 7, '2026-02-28')).toBe(true);
    expect(isWithinDays('2026-03-08', 7, '2026-02-28')).toBe(false);
  });

  it('sin fecha límite nunca está "dentro de la ventana"', () => {
    expect(isWithinDays(null, 7, today)).toBe(false);
  });
});

describe('getBusinessTodayStr', () => {
  it('devuelve una fecha en formato yyyy-MM-dd', () => {
    expect(getBusinessTodayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
