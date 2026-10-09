import { describe, it, expect } from 'vitest';
import {
  effectiveRole, validateCreateUserInput,
} from '../../server/src/utils/userValidation';

const ok = { full_name: 'Ana Pérez', email: 'ana@cun.edu.co', password: 'abcd1234' };

describe('validateCreateUserInput', () => {
  it('acepta datos válidos y aplica rol "user" por defecto', () => {
    const r = validateCreateUserInput(ok);
    expect(r).toEqual({ ok: true, value: { ...ok, cargo: null, role: 'user' } });
  });
  it('recorta espacios y normaliza cargo vacío a null', () => {
    const r = validateCreateUserInput({ ...ok, full_name: '  Ana  ', email: ' ana@cun.edu.co ', cargo: '   ' });
    expect(r).toMatchObject({ ok: true, value: { full_name: 'Ana', email: 'ana@cun.edu.co', cargo: null } });
  });
  it('rechaza cuerpo vacío, nulo o con tipos incorrectos', () => {
    for (const body of [undefined, null, {}, { ...ok, email: 5 }, { ...ok, password: ['x'] }, { ...ok, full_name: '   ' }]) {
      expect(validateCreateUserInput(body).ok).toBe(false);
    }
  });
  it('rechaza correos inválidos y campos demasiado largos', () => {
    expect(validateCreateUserInput({ ...ok, email: 'sin-arroba' }).ok).toBe(false);
    expect(validateCreateUserInput({ ...ok, email: 'a@b' }).ok).toBe(false);
    expect(validateCreateUserInput({ ...ok, full_name: 'x'.repeat(256) }).ok).toBe(false);
    expect(validateCreateUserInput({ ...ok, cargo: 'x'.repeat(256) }).ok).toBe(false);
  });
  it('contraseña: solo es obligatoria (la política original no se altera)', () => {
    expect(validateCreateUserInput({ ...ok, password: '' }).ok).toBe(false);
    expect(validateCreateUserInput({ ...ok, password: 'a' }).ok).toBe(true);
  });
  it('rol desconocido da error de validación (antes era un 500 por el cast a enum)', () => {
    expect(validateCreateUserInput({ ...ok, role: 'superadmin' }).ok).toBe(false);
    expect(validateCreateUserInput({ ...ok, role: 7 }).ok).toBe(false);
    expect(validateCreateUserInput({ ...ok, role: 'project_leader' })).toMatchObject({ ok: true });
  });
});

describe('effectiveRole', () => {
  it('solo un admin puede asignar roles elevados', () => {
    expect(effectiveRole('admin', 'admin')).toBe('admin');
    expect(effectiveRole('project_leader', 'admin')).toBe('user');
    expect(effectiveRole('project_leader', 'project_leader')).toBe('user');
    expect(effectiveRole(undefined, 'admin')).toBe('user');
    expect(effectiveRole('user', 'admin')).toBe('user');
  });
});
