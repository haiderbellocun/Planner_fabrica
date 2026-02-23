import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });

const { Pool } = pg;

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'pruebas_haider',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
});

async function runMigration(migrationFile) {
  const client = await pool.connect();

  try {
    console.log(`\n📋 Running migration: ${migrationFile}`);
    console.log(`📦 Database: ${process.env.PGDATABASE}`);
    console.log('-------------------------------------------\n');

    // Read migration file
    const sql = fs.readFileSync(migrationFile, 'utf8');

    // Execute migration
    await client.query(sql);

    console.log('\n✅ Migration completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error.message);
    console.error('\n');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node run-migration.js <migration-file>');
  process.exit(1);
}

if (!fs.existsSync(migrationFile)) {
  console.error(`Error: Migration file not found: ${migrationFile}`);
  process.exit(1);
}

runMigration(migrationFile);
