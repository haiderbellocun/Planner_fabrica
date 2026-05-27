import pkg from 'pg';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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
      DROP CONSTRAINT IF EXISTS proximos_programas_nivel_programa_check;
    ALTER TABLE public.proximos_programas
      ADD CONSTRAINT proximos_programas_nivel_programa_check
      CHECK (nivel_programa IN ('pregrado','especializacion','maestria','doctorado','diplomado','curso_rapido'));
  `);
  console.log('✅ CHECK constraint updated with diplomado and curso_rapido');
} catch(e) {
  console.error('❌', e.message);
} finally {
  await pool.end();
}
