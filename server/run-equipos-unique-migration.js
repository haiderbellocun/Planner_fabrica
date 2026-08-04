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
    console.log('📦 Running equipos unique-member migration...\n');

    const migrationPath = join(__dirname, '..', 'database', 'add_equipos_unique_member.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    await pool.query(sql);

    console.log('\n✅ Migration completed successfully!\n');

    const result = await pool.query(
      "SELECT COUNT(*) as count FROM pg_constraint WHERE conname = 'equipo_members_profile_id_key'"
    );
    console.log(`  ✓ equipo_members_profile_id_key constraint: ${result.rows[0]?.count}`);

    await pool.end();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
