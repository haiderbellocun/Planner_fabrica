import { describe, it, expect, afterEach } from 'vitest';
import { api } from './api';
import { ApiRequestError, getErrorStatus, isPermissionError } from './apiError';

const realFetch = globalThis.fetch;
const respond = (status: number, body: unknown) => () =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
afterEach(() => { globalThis.fetch = realFetch; });

describe('api client: errores con estado HTTP', () => {
  it('403 conserva el mensaje del servidor y el estado (no se vuelve genérico)', async () => {
    globalThis.fetch = respond(403, { error: 'Solo administradores pueden ver esto' }) as unknown as typeof fetch;
    const err = (await api.get('/x').catch((e: unknown) => e)) as ApiRequestError;
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err.message).toBe('Solo administradores pueden ver esto');
    expect(getErrorStatus(err)).toBe(403);
    expect(isPermissionError(err)).toBe(true);
  });
  it('500 y 404 se distinguen de los permisos', async () => {
    globalThis.fetch = respond(500, { error: 'boom' }) as unknown as typeof fetch;
    expect(isPermissionError(await api.get('/x').catch((e) => e))).toBe(false);
    globalThis.fetch = respond(404, { error: 'no existe' }) as unknown as typeof fetch;
    expect(getErrorStatus(await api.get('/x').catch((e) => e))).toBe(404);
  });
  it('un fallo de red no tiene estado HTTP', () => {
    expect(getErrorStatus(new TypeError('Failed to fetch'))).toBeUndefined();
  });
});
