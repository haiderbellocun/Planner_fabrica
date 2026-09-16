// Aplica database/nullable_weekly_hours_capacity.sql contra la base de datos real.
// A diferencia de run-migration.js (que está fijo a otro archivo y usa DB_* con
// fallback a localhost), este script lee las mismas variables PG* que usa el
// servidor real (server/src/config/database.ts) desde server/.env.
//
// Uso (desde la carpeta server/):
//   node apply_capacity_migration.js
import 'dotenv/config';
import pkg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pkg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST,
        port: parseInt(process.env.PGPORT || '5432', 10),
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
      }
);

async function run() {
  console.log(`📦 Conectando a ${process.env.PGHOST || '(DATABASE_URL)'} / ${process.env.PGDATABASE || ''}...\n`);

  const sql = readFileSync(join(__dirname, '..', 'database', 'nullable_weekly_hours_capacity.sql'), 'utf8');

  try {
    await pool.query(sql);
    console.log('✅ Migración aplicada: weekly_hours_capacity ahora acepta NULL, sin default.\n');

    const check = await pool.query(`
      SELECT is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'weekly_hours_capacity'
    `);
    console.log('🔍 Verificación:', check.rows[0]);

    const nulls = await pool.query(
      'SELECT count(*) FROM public.profiles WHERE weekly_hours_capacity IS NULL'
    );
    console.log(`   Perfiles con capacidad sin configurar ahora mismo: ${nulls.rows[0].count} (se espera 0 justo después de aplicar; los NULL futuros serán perfiles nuevos).`);
  } catch (error) {
    console.error('❌ Error al aplicar la migración:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
