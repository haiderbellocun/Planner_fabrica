require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function addProgramasTemas() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'pruebas_haider',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('📦 Adding programas and temas tables...\n');

    // Read SQL file
    const sqlPath = path.join(__dirname, '../database/add_programas_temas.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute SQL
    await client.query(sql);

    console.log('✅ Migration completed successfully!\n');

    // Verify tables exist
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('programas', 'temas')
      ORDER BY table_name
    `);

    console.log('📋 New tables created:');
    tablesResult.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    // Check programas columns
    console.log('\n📋 Programas columns:');
    const programasColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'programas'
      ORDER BY ordinal_position
    `);
    programasColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    // Check temas columns
    console.log('\n📋 Temas columns:');
    const temasColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'temas'
      ORDER BY ordinal_position
    `);
    temasColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    // Check asignaturas new column
    console.log('\n📋 Asignaturas new column:');
    const asignaturasNewCol = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'asignaturas' AND column_name = 'programa_id'
    `);
    if (asignaturasNewCol.rows.length > 0) {
      console.log(`  ✓ programa_id (${asignaturasNewCol.rows[0].data_type}, nullable: ${asignaturasNewCol.rows[0].is_nullable})`);
    }

    // Check materiales_requeridos new column
    console.log('\n📋 Materiales_requeridos new column:');
    const materialesNewCol = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'materiales_requeridos' AND column_name = 'tema_id'
    `);
    if (materialesNewCol.rows.length > 0) {
      console.log(`  ✓ tema_id (${materialesNewCol.rows[0].data_type}, nullable: ${materialesNewCol.rows[0].is_nullable})`);
    }

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await client.end();
    process.exit(1);
  }
}

addProgramasTemas();
