import pkg from 'pg';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env') });

const { Pool } = pkg;
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5433'),
  database: process.env.PGDATABASE || 'pruebas_haider',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
});

try {
  await pool.query(`
    ALTER TABLE public.asignatura_checklist
      ADD COLUMN IF NOT EXISTS user_checks JSONB NOT NULL DEFAULT '{}';
  `);
  console.log('✅ Column user_checks added to asignatura_checklist');
} catch (e) {
  console.error('❌ Error:', e.message);
  process.exit(1);
} finally {
  await pool.end();
}
