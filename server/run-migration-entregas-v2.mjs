import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const sql = `
  ALTER TABLE public.entregas
    ADD COLUMN IF NOT EXISTS cantidad_semestres    INTEGER,
    ADD COLUMN IF NOT EXISTS materias              TEXT,
    ADD COLUMN IF NOT EXISTS materiales_entregados TEXT;
`;

try {
  await pool.query(sql);
  console.log('✓ Migración OK: columnas cantidad_semestres, materias, materiales_entregados agregadas a entregas');
} catch (err) {
  console.error('✗ Error:', err.message);
} finally {
  await pool.end();
}
