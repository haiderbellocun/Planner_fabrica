#!/usr/bin/env node
/**
 * Database migration runner with tracking
 *
 * Tracks applied migrations in a `schema_migrations` table so each SQL file
 * is executed exactly once, in the order defined below.
 *
 * Usage:
 *   # Local (reads server/.env)
 *   node database/migrate.js
 *
 *   # With explicit DATABASE_URL
 *   DATABASE_URL=postgresql://user:pass@host/db node database/migrate.js
 *
 * Environment (from server/.env or process env):
 *   DATABASE_URL  — full connection string (preferred)
 *   PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD — individual params
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import pg from 'pg';

// ── Load .env from server/ if running locally ──────────────────────────────
const require = createRequire(import.meta.url);
try {
  const dotenv = await import('dotenv');
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', '.env');
  dotenv.config({ path: envPath });
} catch {
  // dotenv is optional — env vars may already be set (Cloud Run / CI)
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Ordered migration files ────────────────────────────────────────────────
// Add new migrations to the END of this list — never reorder existing entries.
const MIGRATIONS = [
  'migration_local.sql',
  '02_content_factory.sql',
  'fix_is_project_member.sql',
  'add_project_leaders_to_existing.sql',
  'add_task_comments.sql',
  'add_programas_temas.sql',
  'add_tipo_programa_to_programas.sql',
  'add_maestro_to_asignaturas.sql',
  'add_semestre_to_asignaturas.sql',
  'update_material_types.sql',
  'update_task_statuses.sql',
  'add_asignatura_to_tasks.sql',
  'add_parent_task_id.sql',
  'add_tema_assignees.sql',
  'add_material_assignees.sql',
  'add_tiempos_estimados.sql',
  'add_horas_estimadas_material_assignees.sql',
  'add_leader_cargo_scope.sql',
  'add_weekly_hours_capacity.sql',
];

// ── Connect ────────────────────────────────────────────────────────────────
const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5433,
      database: process.env.PGDATABASE || 'pruebas_haider',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
    };

const pool = new pg.Pool(poolConfig);

async function run() {
  const client = await pool.connect();
  try {
    // ── Ensure tracking table exists ─────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename    TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ── Fetch already-applied migrations ─────────────────────────────────
    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    console.log(`\n📦 TaskFlow — Database Migrations`);
    console.log(`   Applied: ${applied.size} / ${MIGRATIONS.length}\n`);

    let newCount = 0;

    for (const filename of MIGRATIONS) {
      if (applied.has(filename)) {
        console.log(`   ✓ ${filename}`);
        continue;
      }

      const filePath = join(__dirname, filename);
      let sql;
      try {
        sql = await readFile(filePath, 'utf8');
      } catch {
        console.error(`   ✗ ${filename} — FILE NOT FOUND, skipping`);
        continue;
      }

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        console.log(`   ↑ ${filename} — applied`);
        newCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`   ✗ ${filename} — FAILED`);
        console.error(`     ${err.message}`);
        process.exit(1);
      }
    }

    if (newCount === 0) {
      console.log('   ✅ Database is up to date — nothing to apply.\n');
    } else {
      console.log(`\n   ✅ Applied ${newCount} migration(s) successfully.\n`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Migration runner error:', err);
  process.exit(1);
});
