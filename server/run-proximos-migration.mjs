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
  const sql = readFileSync(join(__dirname, '..', 'database', 'proximos_programas.sql'), 'utf8');
  await pool.query(sql);
  console.log('✅ Migration proximos_programas completed!');
  const r = await pool.query(
    "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name='proximos_programas' AND table_schema='public'"
  );
  console.log('Table exists:', r.rows[0].count === '1' ? 'YES ✓' : 'NO ✗');
} catch (e) {
  console.error('❌ Error:', e.message);
  process.exit(1);
} finally {
  await pool.end();
}
