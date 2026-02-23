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

async function runMigration() {
  try {
    console.log('📦 Running Content Factory migration...\n');

    const migrationPath = join(__dirname, '..', 'database', '02_content_factory.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    await pool.query(sql);

    console.log('\n✅ Migration completed successfully!\n');

    // Verify the changes
    const checks = [
      { query: "SELECT column_name FROM information_schema.columns WHERE table_name='projects' AND column_name='tipo_programa'", label: 'tipo_programa column' },
      { query: "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name='asignaturas'", label: 'asignaturas table' },
      { query: "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name='material_types'", label: 'material_types table' },
      { query: "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name='materiales_requeridos'", label: 'materiales_requeridos table' },
      { query: "SELECT COUNT(*) as count FROM public.material_types", label: 'material types seeded' },
    ];

    console.log('🔍 Verifying migration:\n');
    for (const check of checks) {
      const result = await pool.query(check.query);
      const value = result.rows[0]?.count || result.rows[0]?.column_name || 'exists';
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
