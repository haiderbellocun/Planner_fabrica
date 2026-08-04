import pkg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const { Pool } = pkg;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

async function runMigration() {
  try {
    console.log('📦 Running reports-indexes migration...\n');

    const migrationPath = join(__dirname, '..', 'database', 'add_reports_indexes.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    await pool.query(sql);

    console.log('\n✅ Migration completed successfully!\n');

    const checks = [
      'idx_tsh_task_to_status_started',
      'idx_tsh_to_status_duration',
      'idx_tasks_assignee_status_due',
    ];

    console.log('🔍 Verifying migration:\n');
    for (const name of checks) {
      const result = await pool.query('SELECT COUNT(*) as count FROM pg_indexes WHERE indexname = $1', [name]);
      console.log(`  ✓ ${name}: ${result.rows[0]?.count}`);
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
