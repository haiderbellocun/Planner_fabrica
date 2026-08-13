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
    console.log('📦 Running task_watchers migration...\n');

    const migrationPath = join(__dirname, '..', 'database', 'add_task_watchers.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    await pool.query(sql);

    console.log('\n✅ Migration completed successfully!\n');

    const checks = [
      { query: "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name='task_watchers'", label: 'task_watchers table' },
      { query: "SELECT COUNT(*) as count FROM pg_indexes WHERE indexname = 'idx_task_watchers_task_id'", label: 'idx_task_watchers_task_id' },
      { query: "SELECT COUNT(*) as count FROM pg_indexes WHERE indexname = 'idx_task_watchers_user_id'", label: 'idx_task_watchers_user_id' },
      { query: "SELECT COUNT(*) as count FROM public.task_watchers", label: 'task_watchers rows (backfill)' },
    ];

    console.log('🔍 Verifying migration:\n');
    for (const check of checks) {
      const result = await pool.query(check.query);
      const value = result.rows[0]?.count ?? 'exists';
      console.log(`  ✓ ${check.label}: ${value}`);
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
