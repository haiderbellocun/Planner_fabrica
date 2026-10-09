import { describe, it, expect } from 'vitest';
import { firstName, getInitials, shortName } from './names';

describe('getInitials', () => {
  it('null, undefined, vacío y solo espacios dan "U"', () => {
    expect([null, undefined, '', '   '].map(getInitials)).toEqual(['U', 'U', 'U', 'U']);
  });
  it('espacios dobles o al final no producen "undefined"', () => {
    expect(getInitials('María  de la Cruz ')).toBe('MD');
    expect(getInitials(' Jo ')).toBe('J');
  });
  it('mayúsculas, acentos y emoji como primer carácter', () => {
    expect(getInitials('ángela ñúñez')).toBe('ÁÑ');
    expect(getInitials('😀 Smile')).toBe('😀S');
  });
});

describe('firstName / shortName', () => {
  it('usan el fallback con datos incompletos', () => {
    expect(firstName(null)).toBe('Sin nombre');
    expect(firstName('   ', 'Usuario')).toBe('Usuario');
    expect(shortName(undefined, 2, 'Usuario')).toBe('Usuario');
  });
  it('recortan a las primeras palabras sin espacios sobrantes', () => {
    expect(firstName('  Aleksandra Wiśniewska-Kowalczyk')).toBe('Aleksandra');
    expect(shortName('Ana  María  López Pérez')).toBe('Ana María');
    expect(shortName('Jo')).toBe('Jo');
  });
});
