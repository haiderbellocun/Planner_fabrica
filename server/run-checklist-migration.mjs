import pkg from 'pg';
import { readFileSync } from 'fs';
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
  const sql = readFileSync(join(__dirname, '..', 'database', 'asignatura_checklist.sql'), 'utf8');
  await pool.query(sql);
  console.log('✅ Migration asignatura_checklist completed!');
  const r = await pool.query(
    "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_name='asignatura_checklist' AND table_schema='public'"
  );
  console.log('Table exists:', r.rows[0].c === '1' ? 'YES ✓' : 'NO ✗');
} catch (e) {
  console.error('❌ Error:', e.message);
  process.exit(1);
} finally {
  await pool.end();
}
