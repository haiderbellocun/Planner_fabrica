import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runInTransaction } from '../../server/src/utils/transaction';

// Base de datos simulada: registra por qué vía (pool o cliente dedicado) pasa cada sentencia.
const log: string[] = [];
const release = vi.fn();
const fail = { on: '' };
const exec = (via: string) => async (text: string) => {
  log.push(`${via}:${text.trim().split(/\s+/).slice(0, 3).join(' ')}`);
  if (fail.on && text.includes(fail.on)) throw new Error('boom');
  if (text.includes('FROM public.equipos WHERE id')) return { rows: [{ id: 'e1' }] };
  if (text.includes('FROM public.users WHERE email')) return { rows: [] };
  if (text.includes('INSERT INTO public.users')) return { rows: [{ id: 'u1', email: 'a@b.co', full_name: 'Ana' }] };
  if (text.includes('INSERT INTO public.profiles')) return { rows: [{ id: 'p1' }] };
  return { rows: [] };
};
const client = { query: exec('client'), release };
const pool = { connect: async () => client, query: exec('pool') };

vi.mock('../../server/src/config/database', () => ({
  default: pool,
  pool,
  query: exec('pool'),
  withTransaction: (fn: (c: typeof client) => Promise<unknown>) => runInTransaction(pool as never, fn as never),
}));
vi.mock('../../server/src/config/database.js', () => ({
  default: pool,
  pool,
  query: exec('pool'),
  withTransaction: (fn: (c: typeof client) => Promise<unknown>) => runInTransaction(pool as never, fn as never),
}));

const res = () => {
  const r: { statusCode?: number; body?: unknown; status: (n: number) => typeof r; json: (b: unknown) => typeof r } = {
    status(n) { r.statusCode = n; return r; },
    json(b) { r.body = b; return r; },
  };
  return r;
};

beforeEach(() => { log.length = 0; release.mockClear(); fail.on = ''; });

describe('setEquipoMembers', () => {
  it('BEGIN, escrituras y COMMIT van por el cliente dedicado; nada de la transacción pasa por el pool', async () => {
    const { setEquipoMembers } = await import('../../server/src/controllers/equiposController');
    const r = res();
    await setEquipoMembers({ params: { id: 'e1' }, body: { profileIds: ['p1', 'p2'] } } as never, r as never);
    const begin = log.indexOf('client:BEGIN');
    const commit = log.indexOf('client:COMMIT');
    expect(begin).toBeGreaterThan(-1);
    expect(commit).toBeGreaterThan(begin);
    const inside = log.slice(begin + 1, commit);
    expect(inside.length).toBe(3); // 1 DELETE + 2 INSERT
    expect(inside.every((l) => l.startsWith('client:'))).toBe(true);
    expect(release).toHaveBeenCalledTimes(1);
  });
  it('si una escritura falla: ROLLBACK en el cliente, respuesta 500 y conexión liberada', async () => {
    const { setEquipoMembers } = await import('../../server/src/controllers/equiposController');
    fail.on = 'INSERT INTO public.equipo_members';
    const r = res();
    await setEquipoMembers({ params: { id: 'e1' }, body: { profileIds: ['p1'] } } as never, r as never);
    expect(log).toContain('client:ROLLBACK');
    expect(log).not.toContain('client:COMMIT');
    expect(r.statusCode).toBe(500);
    expect(release).toHaveBeenCalledTimes(1);
  });
});

describe('createUser', () => {
  it('crea usuario, perfil y rol en una sola transacción del cliente', async () => {
    const { createUser } = await import('../../server/src/controllers/adminUsersController');
    const r = res();
    await createUser({
      user: { role: 'admin' },
      body: { full_name: 'Ana', email: 'a@b.co', password: 'abcd', role: 'user' },
    } as never, r as never);
    expect(r.statusCode).toBe(201);
    const begin = log.indexOf('client:BEGIN');
    const commit = log.indexOf('client:COMMIT');
    expect(begin).toBeGreaterThan(-1);
    expect(log.slice(begin, commit + 1).every((l) => l.startsWith('client:'))).toBe(true);
    expect(release).toHaveBeenCalledTimes(1);
  });
  it('un fallo en el chequeo previo devuelve 500 sin abrir transacción', async () => {
    const { createUser } = await import('../../server/src/controllers/adminUsersController');
    fail.on = 'FROM public.users WHERE email';
    const r = res();
    await createUser({
      user: { role: 'admin' },
      body: { full_name: 'Ana', email: 'a@b.co', password: 'abcd' },
    } as never, r as never);
    expect(r.statusCode).toBe(500);
    expect(log.some((l) => l.includes('BEGIN'))).toBe(false);
  });
});
