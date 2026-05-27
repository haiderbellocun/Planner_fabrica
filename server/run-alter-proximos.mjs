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
    ALTER TABLE public.proximos_programas
      ADD COLUMN IF NOT EXISTS dependencia TEXT,
      ADD COLUMN IF NOT EXISTS link TEXT;
  `);
  console.log('✅ Columns dependencia and link added to proximos_programas');
} catch (e) {
  console.error('❌ Error:', e.message);
  process.exit(1);
} finally {
  await pool.end();
}
