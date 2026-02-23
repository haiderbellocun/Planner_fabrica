require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function createCommentsTable() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'pruebas_haider',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('📦 Creating task_comments table...\n');

    // Read SQL file
    const sqlPath = path.join(__dirname, '../database/add_task_comments.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute SQL
    await client.query(sql);

    console.log('✅ Table created successfully!\n');

    // Verify table exists
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'task_comments'
    `);

    if (result.rows.length > 0) {
      console.log('✓ task_comments table exists');

      // Check columns
      const columnsResult = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'task_comments'
        ORDER BY ordinal_position
      `);

      console.log('\nColumns:');
      columnsResult.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('❌ Table not found');
    }

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await client.end();
    process.exit(1);
  }
}

createCommentsTable();
