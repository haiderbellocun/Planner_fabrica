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

async function updateTaskStatuses() {
  try {
    console.log('🔄 Actualizando estados de tareas...\n');

    // Read the SQL file
    const sqlPath = path.join(__dirname, '../database/update_task_statuses.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the migration
    await pool.query(sql);

    console.log('✅ Estados actualizados exitosamente\n');

    // Verify the update
    const result = await pool.query(`
      SELECT name, color, description, display_order
      FROM public.task_statuses
      ORDER BY display_order
    `);

    console.log('📋 Nuevos estados de tareas:\n');
    result.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.name} (${row.color})`);
      if (row.description) {
        console.log(`     ${row.description}`);
      }
    });

    console.log(`\n✅ Total: ${result.rows.length} estados\n`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al actualizar estados:', error);
    await pool.end();
    process.exit(1);
  }
}

updateTaskStatuses();
