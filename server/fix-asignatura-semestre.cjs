const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'pruebas_haider',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function runMigration() {
  try {
    console.log('🔄 Corrigiendo campo en asignaturas: maestro_id → semestre...');

    // Eliminar maestro_id si existe
    await pool.query(`
      ALTER TABLE public.asignaturas
      DROP COLUMN IF EXISTS maestro_id;
    `);
    console.log('✅ Columna maestro_id eliminada');

    // Agregar semestre
    await pool.query(`
      ALTER TABLE public.asignaturas
      ADD COLUMN IF NOT EXISTS semestre INTEGER;
    `);
    console.log('✅ Columna semestre agregada');

    // Agregar índice
    await pool.query(`
      DROP INDEX IF EXISTS idx_asignaturas_maestro_id;
      CREATE INDEX IF NOT EXISTS idx_asignaturas_semestre ON public.asignaturas(semestre);
    `);
    console.log('✅ Índice creado');

    // Verificar el resultado
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'asignaturas' AND column_name IN ('maestro_id', 'semestre')
    `);

    console.log('✅ Verificación de columnas:', result.rows);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
