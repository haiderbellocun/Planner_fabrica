import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || process.env.DB_HOST,
        port: parseInt(process.env.PGPORT || process.env.DB_PORT || '5432', 10),
        database: process.env.PGDATABASE || process.env.DB_NAME,
        user: process.env.PGUSER || process.env.DB_USER,
        password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
      }
);

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE public.notifications 
      ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
    `);
    console.log('Migration successful: read_at column added');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
