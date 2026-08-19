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
    console.log('📦 Running project_pins migration...\n');

    const migrationPath = join(__dirname, '..', 'database', 'add_project_pins.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    await pool.query(sql);

    console.log('\n✅ Migration completed successfully!\n');

    const checks = [
      { query: "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name='project_pins'", label: 'project_pins table' },
      { query: "SELECT COUNT(*) as count FROM pg_indexes WHERE indexname = 'idx_project_pins_project_id'", label: 'idx_project_pins_project_id' },
      { query: "SELECT COUNT(*) as count FROM pg_indexes WHERE indexname = 'idx_project_pins_user_id'", label: 'idx_project_pins_user_id' },
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
