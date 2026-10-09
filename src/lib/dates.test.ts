import { describe, it, expect, beforeAll } from 'vitest';
import {
  endOfWorkWeek, parseDateOnly, rollingDateRange, resolvePeriodRangeFor, startOfWorkWeek, toLocalISODate,
} from './dates';

// Colombia (UTC-5, sin horario de verano): a las 19:00 locales ya es el día siguiente en UTC.
beforeAll(() => { process.env.TZ = 'America/Bogota'; });

describe('toLocalISODate', () => {
  it('no corre el día por UTC a última hora de la tarde', () => {
    const d = new Date(2026, 9, 9, 22, 30); // vie 9 oct 22:30 local
    expect(toLocalISODate(d)).toBe('2026-10-09');
    if (process.env.TZ === 'America/Bogota' && d.getTimezoneOffset() === 300) {
      expect(d.toISOString().slice(0, 10)).toBe('2026-10-10'); // el bug que se evita
    }
  });
  it('rellena mes y día de un dígito', () => {
    expect(toLocalISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('parseDateOnly', () => {
  it('"2026-03-01" es 1 de marzo local, no febrero', () => {
    const d = parseDateOnly('2026-03-01')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 1]);
  });
  it('ignora la hora de un timestamp ISO', () => {
    const d = parseDateOnly('2026-12-31T00:00:00.000Z')!;
    expect([d.getMonth(), d.getDate()]).toEqual([11, 31]);
  });
  it('valores vacíos o inválidos', () => {
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly('abc')).toBeNull();
  });
});

describe('semana de trabajo (lunes a domingo)', () => {
  const iso = (d: Date) => toLocalISODate(d);
  it('lunes inicia su propia semana', () => {
    expect(iso(startOfWorkWeek(new Date(2026, 9, 5)))).toBe('2026-10-05');
  });
  it('domingo pertenece a la semana que termina, no a la siguiente', () => {
    expect(iso(startOfWorkWeek(new Date(2026, 9, 11)))).toBe('2026-10-05');
    expect(iso(endOfWorkWeek(new Date(2026, 9, 11)))).toBe('2026-10-11');
  });
  it('sábado a las 23:59 sigue en la misma semana; el lunes 00:00 cambia', () => {
    expect(iso(startOfWorkWeek(new Date(2026, 9, 10, 23, 59)))).toBe('2026-10-05');
    expect(iso(startOfWorkWeek(new Date(2026, 9, 12, 0, 0)))).toBe('2026-10-12');
  });
  it('cruza el cambio de mes', () => {
    expect(iso(startOfWorkWeek(new Date(2026, 10, 1)))).toBe('2026-10-26');
    expect(iso(endOfWorkWeek(new Date(2026, 9, 28)))).toBe('2026-11-01');
  });
  it('cruza el cambio de año', () => {
    expect(iso(startOfWorkWeek(new Date(2027, 0, 1)))).toBe('2026-12-28'); // viernes
    expect(iso(endOfWorkWeek(new Date(2026, 11, 30)))).toBe('2027-01-03');
  });
});

describe('resolvePeriodRangeFor', () => {
  it('hoy usa la fecha local aunque en UTC sea el día siguiente', () => {
    const r = resolvePeriodRangeFor('hoy', {}, new Date(2026, 9, 9, 22, 0));
    expect(r).toEqual({ date_from: '2026-10-09', date_to: '2026-10-09' });
  });
  it('semana: lunes a domingo', () => {
    expect(resolvePeriodRangeFor('semana', {}, new Date(2026, 9, 9))).toEqual({ date_from: '2026-10-05', date_to: '2026-10-11' });
  });
  it('mes: primer y último día, incluidos febrero bisiesto y diciembre', () => {
    expect(resolvePeriodRangeFor('mes', {}, new Date(2028, 1, 15))).toEqual({ date_from: '2028-02-01', date_to: '2028-02-29' });
    expect(resolvePeriodRangeFor('mes', {}, new Date(2026, 1, 15))).toEqual({ date_from: '2026-02-01', date_to: '2026-02-28' });
    expect(resolvePeriodRangeFor('mes', {}, new Date(2026, 11, 31, 23, 0))).toEqual({ date_from: '2026-12-01', date_to: '2026-12-31' });
  });
  it('personalizado exige ambos extremos; todo no filtra', () => {
    expect(resolvePeriodRangeFor('personalizado', { from: '2026-01-01', to: '2026-01-31' })).toEqual({ date_from: '2026-01-01', date_to: '2026-01-31' });
    expect(resolvePeriodRangeFor('personalizado', { from: '2026-01-01' })).toEqual({});
    expect(resolvePeriodRangeFor('todo')).toEqual({});
  });
});

describe('rollingDateRange', () => {
  it('7 días hacia atrás desde la noche del viernes (no salta a sábado)', () => {
    expect(rollingDateRange(7, new Date(2026, 9, 9, 22, 0))).toEqual({ date_from: '2026-10-02', date_to: '2026-10-09' });
  });
  it('cruza mes y año', () => {
    expect(rollingDateRange(30, new Date(2026, 0, 10))).toEqual({ date_from: '2025-12-11', date_to: '2026-01-10' });
    expect(rollingDateRange(7, new Date(2026, 2, 3))).toEqual({ date_from: '2026-02-24', date_to: '2026-03-03' });
  });
  it('el día de hoy coincide con la clave diaria de Lumina (fecha local)', () => {
    const noche = new Date(2026, 9, 9, 23, 30);
    expect(toLocalISODate(noche)).toBe('2026-10-09');
    expect(toLocalISODate(new Date(2026, 9, 10, 0, 5))).toBe('2026-10-10');
  });
});
