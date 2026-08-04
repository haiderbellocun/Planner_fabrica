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
    console.log('📦 Running task-ranks migration...\n');

    const migrationPath = join(__dirname, '..', 'database', 'add_task_ranks.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    await pool.query(sql);

    console.log('\n✅ Migration completed successfully!\n');

    const checks = [
      { query: "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='tasks' AND column_name='board_rank'", label: 'tasks.board_rank column' },
      { query: "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='tasks' AND column_name='backlog_rank'", label: 'tasks.backlog_rank column' },
      { query: "SELECT COUNT(*) as count FROM public.tasks WHERE board_rank IS NULL", label: 'tasks with NULL board_rank' },
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
