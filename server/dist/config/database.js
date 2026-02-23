import pg from 'pg';
import { env } from './env.js';
const { Pool } = pg;
const poolConfig = env.DATABASE_URL
    ? {
        connectionString: env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    }
    : {
        host: env.PGHOST,
        port: env.PGPORT,
        database: env.PGDATABASE,
        user: env.PGUSER,
        password: env.PGPASSWORD,
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
export const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        if (env.NODE_ENV !== 'production') {
            const duration = Date.now() - start;
            console.log('📊 Executed query', { text, duration, rows: res.rowCount });
        }
        return res;
    }
    catch (error) {
        console.error('❌ Query error:', error);
        throw error;
    }
};
export default pool;
