// Ejecuta `fn` dentro de una transacción en UNA conexión dedicada del pool.
// pool.query() puede tomar conexiones distintas en cada llamada, así que BEGIN/COMMIT/ROLLBACK
// emitidos con él no delimitan nada. La conexión siempre se libera.
export interface TxClient {
  query(text: string, params?: unknown[]): Promise<any>;
  release(): void;
}
export interface TxPool {
  connect(): Promise<TxClient>;
}

export async function runInTransaction<T>(pool: TxPool, fn: (client: TxClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
