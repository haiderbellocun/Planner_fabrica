const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'pruebas_haider',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkStatuses() {
  try {
    console.log('📊 Estados actuales:\n');

    const result = await pool.query(`
      SELECT id, name, color, display_order
      FROM public.task_statuses
      ORDER BY display_order
    `);

    result.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.name} (color: ${row.color}, order: ${row.display_order})`);
      console.log(`     ID: ${row.id}`);
    });

    console.log(`\n✅ Total: ${result.rows.length} estados\n`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkStatuses();
