import { describe, it, expect, vi } from 'vitest';
import { runInTransaction, type TxClient, type TxPool } from '../../server/src/utils/transaction';

function fakePool(failOn?: string) {
  const calls: string[] = [];
  const release = vi.fn();
  const client: TxClient = {
    query: vi.fn(async (text: string) => {
      calls.push(text);
      if (failOn && text.startsWith(failOn)) throw new Error('fallo ' + failOn);
      return { rows: [] };
    }),
    release,
  };
  const connect = vi.fn(async () => client);
  const pool: TxPool = { connect };
  return { pool, calls, release, connect, client };
}

describe('runInTransaction', () => {
  it('BEGIN, trabajo y COMMIT en la misma conexión; la libera', async () => {
    const { pool, calls, release, connect } = fakePool();
    const out = await runInTransaction(pool, async (c) => { await c.query('INSERT 1'); return 42; });
    expect(out).toBe(42);
    expect(calls).toEqual(['BEGIN', 'INSERT 1', 'COMMIT']);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });
  it('si el trabajo falla: ROLLBACK, relanza el error original y libera', async () => {
    const { pool, calls, release } = fakePool('INSERT');
    await expect(runInTransaction(pool, async (c) => { await c.query('INSERT 1'); })).rejects.toThrow('fallo INSERT');
    expect(calls).toEqual(['BEGIN', 'INSERT 1', 'ROLLBACK']);
    expect(release).toHaveBeenCalledTimes(1);
  });
  it('si COMMIT falla: ROLLBACK, relanza y libera', async () => {
    const { pool, calls, release } = fakePool('COMMIT');
    await expect(runInTransaction(pool, async () => 1)).rejects.toThrow('fallo COMMIT');
    expect(calls).toEqual(['BEGIN', 'COMMIT', 'ROLLBACK']);
    expect(release).toHaveBeenCalledTimes(1);
  });
  it('si ROLLBACK también falla, se relanza el error original y se libera igual', async () => {
    const { pool, release, client } = fakePool();
    (client.query as ReturnType<typeof vi.fn>).mockImplementation(async (t: string) => {
      if (t === 'ROLLBACK') throw new Error('rollback roto');
      return { rows: [] };
    });
    await expect(runInTransaction(pool, async () => { throw new Error('original'); })).rejects.toThrow('original');
    expect(release).toHaveBeenCalledTimes(1);
  });
  it('si no se logra conectar, no hay nada que liberar y el error sale tal cual', async () => {
    const pool: TxPool = { connect: async () => { throw new Error('sin conexiones'); } };
    await expect(runInTransaction(pool, async () => 1)).rejects.toThrow('sin conexiones');
  });
});
