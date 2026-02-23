const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
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
    console.log('🔄 Ejecutando migración: agregar tipo_programa a programas...');

    const migrationPath = path.join(__dirname, '..', 'database', 'add_tipo_programa_to_programas.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    await pool.query(migrationSQL);

    console.log('✅ Migración completada exitosamente');
    console.log('✅ Campo tipo_programa agregado a tabla programas');

    // Verificar el resultado
    const result = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'programas' AND column_name = 'tipo_programa'
    `);

    console.log('✅ Verificación:', result.rows);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
