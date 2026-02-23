import pkg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'pruebas_haider',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Cun2023@postgres',
});

async function addLeadersToProjects() {
  try {
    console.log('📦 Adding project leaders to existing projects...\n');

    const sqlPath = join(__dirname, '..', 'database', 'add_project_leaders_to_existing.sql');
    const sql = readFileSync(sqlPath, 'utf8');

    const result = await pool.query(sql);

    console.log('\n✅ Process completed successfully!\n');

    // Show the results
    if (result.length > 0) {
      const lastResult = result[result.length - 1];
      if (lastResult.rows && lastResult.rows.length > 0) {
        console.log('📊 Projects and members:');
        lastResult.rows.forEach(row => {
          console.log(`  - ${row.project_name}: ${row.total_members} members (${row.members || 'none'})`);
        });
      }
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

addLeadersToProjects();
