import { describe, it, expect } from 'vitest';
import { resolveSessionUser } from '../../server/src/middleware/sessionUser';

const claims = { id: 'u1', profileId: 'p-token', email: 'a@cun.edu.co', role: 'admin' };

describe('resolveSessionUser', () => {
  it('rechaza si el usuario ya no existe', () => {
    expect(resolveSessionUser(claims, undefined)).toEqual({ ok: false, status: 401, error: 'Invalid token' });
  });
  it('rechaza una cuenta deshabilitada aunque el token siga vigente', () => {
    expect(resolveSessionUser(claims, { is_active: false, profile_id: 'p1', role: 'admin' }))
      .toEqual({ ok: false, status: 401, error: 'Account is disabled' });
    expect(resolveSessionUser(claims, { is_active: null, profile_id: 'p1', role: 'admin' }).ok).toBe(false);
  });
  it('el rol de la BD sustituye al del token (degradación de admin a user)', () => {
    const r = resolveSessionUser(claims, { is_active: true, profile_id: 'p1', role: 'user' });
    expect(r).toMatchObject({ ok: true, user: { role: 'user', id: 'u1', email: 'a@cun.edu.co' } });
  });
  it('ascenso: un token de "user" obtiene el rol nuevo', () => {
    const r = resolveSessionUser({ ...claims, role: 'user' }, { is_active: true, profile_id: 'p1', role: 'project_leader' });
    expect(r).toMatchObject({ ok: true, user: { role: 'project_leader' } });
  });
  it('sin fila de rol el rol efectivo es "user", nunca el del token', () => {
    const r = resolveSessionUser(claims, { is_active: true, profile_id: 'p1', role: null });
    expect(r).toMatchObject({ ok: true, user: { role: 'user' } });
  });
  it('el profileId de la BD manda; el del token solo es respaldo', () => {
    expect(resolveSessionUser(claims, { is_active: true, profile_id: 'p-db', role: 'user' }))
      .toMatchObject({ user: { profileId: 'p-db' } });
    expect(resolveSessionUser(claims, { is_active: true, profile_id: null, role: 'user' }))
      .toMatchObject({ user: { profileId: 'p-token' } });
  });
});
