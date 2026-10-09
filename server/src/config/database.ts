import { runInTransaction, type TxClient, type TxPool } from '../utils/transaction.js';
import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

const poolConfig: pg.PoolConfig = env.DATABASE_URL
  ? {
      connectionString: env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  : {
      host: env.PGHOST!,
      port: env.PGPORT!,
      database: env.PGDATABASE!,
      user: env.PGUSER!,
      password: env.PGPASSWORD!,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

export const pool = new Pool(poolConfig);

// Test connection
pool.on('connect', () => {
  if (env.NODE_ENV !== 'production') {
    console.log('✅ Connected to PostgreSQL database');
  }
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    if (env.NODE_ENV !== 'production') {
      const duration = Date.now() - start;
      console.log('📊 Executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('❌ Query error:', error);
    throw error;
  }
};

export const withTransaction = <T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> =>
  runInTransaction(pool as unknown as TxPool, fn as (client: TxClient) => Promise<T>);

export default pool;
