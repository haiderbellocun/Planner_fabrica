import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ACCOUNT_DISABLED_ERROR, __resetSessionHandlingForTests, consumeAccountDisabledNotice,
  handleAccountDisabled, isAccountDisabledResponse, peekAccountDisabledNotice,
} from './session';
import { api } from './api';

const makeEnv = (hash = '#/projects') => {
  const store = new Map<string, string>();
  const reload = vi.fn();
  return {
    reload,
    env: {
      localStorage: { removeItem: vi.fn((k: string) => { store.delete('L' + k); }) },
      sessionStorage: {
        setItem: (k: string, v: string) => { store.set(k, v); },
        getItem: (k: string) => store.get(k) ?? null,
        removeItem: (k: string) => { store.delete(k); },
      },
      location: { hash, reload },
    },
  };
};

beforeEach(() => __resetSessionHandlingForTests());

describe('isAccountDisabledResponse', () => {
  it('solo un 401 con el mensaje exacto cuenta como cuenta deshabilitada', () => {
    expect(isAccountDisabledResponse(401, { error: ACCOUNT_DISABLED_ERROR })).toBe(true);
    expect(isAccountDisabledResponse(401, { error: 'Invalid token' })).toBe(false);
    expect(isAccountDisabledResponse(403, { error: ACCOUNT_DISABLED_ERROR })).toBe(false);
    expect(isAccountDisabledResponse(401, null)).toBe(false);
    expect(isAccountDisabledResponse(401, 'Account is disabled')).toBe(false);
  });
});

describe('handleAccountDisabled', () => {
  it('limpia el token, deja el aviso y redirige al login con recarga', () => {
    const { env, reload } = makeEnv();
    handleAccountDisabled(env);
    expect(env.localStorage.removeItem).toHaveBeenCalledWith('taskflow_token');
    expect(env.location.hash).toBe('#/auth');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(peekAccountDisabledNotice(env)).toBe(true);
  });
  it('varias peticiones fallidas a la vez redirigen una sola vez', () => {
    const { env, reload } = makeEnv();
    handleAccountDisabled(env); handleAccountDisabled(env); handleAccountDisabled(env);
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it('ya en el login no recarga (sin bucle)', () => {
    const { env, reload } = makeEnv('#/auth');
    handleAccountDisabled(env); handleAccountDisabled(env);
    expect(reload).not.toHaveBeenCalled();
    expect(peekAccountDisabledNotice(env)).toBe(true);
  });
  it('el aviso se consume una sola vez', () => {
    const { env } = makeEnv('#/auth');
    handleAccountDisabled(env);
    expect(consumeAccountDisabledNotice(env)).toBe(true);
    expect(consumeAccountDisabledNotice(env)).toBe(false);
  });
});

describe('api client', () => {
  const realFetch = globalThis.fetch;
  const respond = (status: number, body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  afterEach(() => { globalThis.fetch = realFetch; sessionStorage.clear(); localStorage.clear(); });

  it('401 de cuenta deshabilitada: borra el token local, marca el aviso y lanza el error', async () => {
    localStorage.setItem('taskflow_token', 'abc');
    globalThis.fetch = respond(401, { error: ACCOUNT_DISABLED_ERROR }) as unknown as typeof fetch;
    window.location.hash = '#/auth'; // evita la recarga de jsdom; el flujo de redirección ya está probado arriba
    await expect(api.get('/api/projects')).rejects.toThrow(ACCOUNT_DISABLED_ERROR);
    expect(localStorage.getItem('taskflow_token')).toBeNull();
    expect(peekAccountDisabledNotice()).toBe(true);
  });
  it('otro 401 (token inválido) no toca la sesión ni deja aviso', async () => {
    localStorage.setItem('taskflow_token', 'abc');
    globalThis.fetch = respond(401, { error: 'Invalid token' }) as unknown as typeof fetch;
    await expect(api.get('/api/projects')).rejects.toThrow('Invalid token');
    expect(localStorage.getItem('taskflow_token')).toBe('abc');
    expect(peekAccountDisabledNotice()).toBe(false);
  });
  it('errores no 401 conservan su comportamiento', async () => {
    globalThis.fetch = respond(500, { error: 'Internal server error' }) as unknown as typeof fetch;
    await expect(api.get('/x')).rejects.toThrow('Internal server error');
  });
});
