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
    console.log('📦 Running equipo_plan_items migration...\n');

    const migrationPath = join(__dirname, '..', 'database', 'add_equipo_plan_items.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    await pool.query(sql);

    console.log('\n✅ Migration completed successfully!\n');

    const checks = [
      { query: "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name='equipo_plan_items'", label: 'equipo_plan_items table' },
      { query: "SELECT COUNT(*) as count FROM pg_constraint WHERE conname = 'equipo_plan_items_week_start_is_monday'", label: 'week_start-is-Monday check constraint' },
      { query: "SELECT COUNT(*) as count FROM pg_indexes WHERE indexname = 'idx_equipo_plan_items_equipo_week'", label: 'equipo+week index' },
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
