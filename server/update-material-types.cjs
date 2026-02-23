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

async function updateMaterialTypes() {
  try {
    console.log('🔄 Actualizando tipos de materiales...\n');

    // Read the SQL file
    const sqlPath = path.join(__dirname, '../database/update_material_types.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the migration
    await pool.query(sql);

    console.log('✅ Tipos de materiales actualizados exitosamente\n');

    // Verify the update
    const result = await pool.query(`
      SELECT name, description, icon, display_order
      FROM public.material_types
      ORDER BY display_order
    `);

    console.log('📋 Nuevos tipos de materiales:\n');
    result.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.icon} ${row.description} (${row.name})`);
    });

    console.log(`\n✅ Total: ${result.rows.length} tipos de materiales\n`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al actualizar tipos de materiales:', error);
    await pool.end();
    process.exit(1);
  }
}

updateMaterialTypes();
