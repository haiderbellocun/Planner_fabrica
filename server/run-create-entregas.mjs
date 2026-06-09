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
    CREATE TABLE IF NOT EXISTS public.entregas (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre_proyecto  TEXT NOT NULL,
      escuela          TEXT,
      nivel_programa   TEXT CHECK(nivel_programa IN ('pregrado','especializacion','maestria','doctorado','diplomado','curso_rapido')),
      modalidad        TEXT CHECK(modalidad IN ('virtual','hibrida','presencial')),
      fecha_entrega    DATE NOT NULL,
      entregado_a      TEXT,
      tipo_entrega     TEXT NOT NULL DEFAULT 'primera_entrega'
                         CHECK(tipo_entrega IN ('primera_entrega','correccion','final')),
      estado           TEXT NOT NULL DEFAULT 'pendiente'
                         CHECK(estado IN ('aceptado','con_observaciones','rechazado','pendiente')),
      notas            TEXT,
      created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS entregas_fecha_idx ON public.entregas(fecha_entrega DESC);
    CREATE INDEX IF NOT EXISTS entregas_estado_idx ON public.entregas(estado);

    CREATE OR REPLACE FUNCTION update_entregas_updated_at()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$;

    DROP TRIGGER IF EXISTS entregas_updated_at_trigger ON public.entregas;
    CREATE TRIGGER entregas_updated_at_trigger
      BEFORE UPDATE ON public.entregas
      FOR EACH ROW EXECUTE FUNCTION update_entregas_updated_at();
  `);
  console.log('✅ Table entregas created successfully');
} catch (e) {
  console.error('❌ Error:', e.message);
  process.exit(1);
} finally {
  await pool.end();
}
