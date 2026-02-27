/**
 * Migrates local PostgreSQL (pruebas_haider) → Cloud SQL (planner_db)
 * 1. Applies all schema migrations to Cloud SQL (schema only)
 * 2. Clears existing data from Cloud SQL (in reverse FK order)
 * 3. Copies all data from local in dependency order
 *
 * Run from project root:
 *   node database/migrate-to-cloud.mjs
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pg = require('../server/node_modules/pg');
const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));

const LOCAL_CFG = { host: 'localhost', port: 5433, database: 'pruebas_haider', user: 'postgres', password: 'postgres' };
const CLOUD_CFG = { host: '136.116.213.121', port: 5432, database: 'planner_db', user: 'planner_user', password: 'h4ider9103##', ssl: { rejectUnauthorized: false } };

const LOCAL = new Pool(LOCAL_CFG);

// ── Migration files in order ───────────────────────────────────────────────
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

// Tables in dependency order — parents before children for INSERT, reverse for DELETE
const TABLE_ORDER = [
  'users',
  'profiles',
  'user_roles',
  'task_statuses',
  'projects',
  'project_members',
  'programas',
  'asignaturas',
  'temas',
  'material_types',
  'materiales_requeridos',
  'tasks',
  'task_status_history',
  'task_activity_log',
  'task_comments',
  'task_tema_assignees',
  'task_material_assignees',
  'tiempos_estimados',
  'leader_cargo_scope',
  'notifications',
];

function freshPool() {
  return new Pool({ ...CLOUD_CFG, max: 1 });
}

async function runQuery(cfg, sql, params) {
  const pool = new Pool({ ...cfg, max: 1 });
  try { return await pool.query(sql, params); }
  finally { await pool.end(); }
}

async function applyMigrations() {
  console.log('\n📋 Step 1: Applying schema migrations...\n');
  for (const filename of MIGRATIONS) {
    const filePath = join(__dirname, filename);
    let sql;
    try { sql = await readFile(filePath, 'utf8'); }
    catch { console.log(`   ⚠  ${filename} not found`); continue; }

    const pool = freshPool();
    try {
      await pool.query('BEGIN');
      await pool.query(sql);
      await pool.query('COMMIT');
      console.log(`   ✓ ${filename}`);
    } catch (err) {
      await pool.query('ROLLBACK').catch(() => {});
      if (['42P07','42710','42701'].includes(err.code) || err.message.includes('already exists') || err.message.includes('cannot change name')) {
        console.log(`   ~ ${filename} (schema ya existe)`);
      } else {
        console.error(`   ✗ ${filename}: ${err.message}`);
      }
    } finally { await pool.end(); }
  }
}

async function clearCloudData() {
  console.log('\n🗑  Step 2: Clearing existing Cloud SQL data (reverse order)...\n');
  // Delete in reverse order to respect FK constraints
  for (const table of [...TABLE_ORDER].reverse()) {
    const pool = freshPool();
    try {
      const r = await pool.query(`DELETE FROM "${table}"`);
      console.log(`   ✓ ${table.padEnd(40)} ${r.rowCount} filas eliminadas`);
    } catch (err) {
      console.log(`   ~ ${table}: ${err.message.split('\n')[0]}`);
    } finally { await pool.end(); }
  }
}

async function insertTable(table, rows) {
  if (rows.length === 0) {
    console.log(`   ○ ${table.padEnd(40)} vacía, skip`);
    return;
  }
  const columns = Object.keys(rows[0]);
  const pool = freshPool();
  try {
    await pool.query('BEGIN');
    for (const row of rows) {
      const values = columns.map(c => row[c]);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const colList = columns.map(c => `"${c}"`).join(', ');
      await pool.query(
        `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        values
      );
    }
    await pool.query('COMMIT');
    console.log(`   ✓ ${table.padEnd(40)} ${rows.length} filas copiadas`);
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error(`   ✗ ${table}: ${err.message.split('\n')[0]}`);
  } finally { await pool.end(); }
}

async function copyData() {
  console.log('\n📦 Step 3: Copying data from local → Cloud SQL...\n');

  for (const table of TABLE_ORDER) {
    const localResult = await LOCAL.query(`SELECT * FROM "${table}"`);
    const rows = localResult.rows;

    if (table === 'users') {
      // The on_user_created trigger auto-creates profiles with wrong UUIDs.
      // Disable it, insert users manually, then re-enable.
      const pool = freshPool();
      try {
        await pool.query('ALTER TABLE users DISABLE TRIGGER on_user_created');
        await pool.end();
        await insertTable(table, rows);
        const pool2 = freshPool();
        await pool2.query('ALTER TABLE users ENABLE TRIGGER on_user_created');
        await pool2.end();
      } catch (err) {
        console.error(`   ⚠  Could not disable trigger: ${err.message}`);
        // Fallback: insert users anyway (trigger will create profiles), then we'll fix profiles
        await insertTable(table, rows);
        // Delete auto-created profiles so we can insert them from local
        const clean = freshPool();
        await clean.query('DELETE FROM profiles');
        await clean.end();
        console.log(`   ↺  Cleaned auto-generated profiles (trigger ran)`);
      }
      continue;
    }

    if (table === 'tasks') {
      // tasks has:
      // 1. Self-referential FK: parent_task_id → tasks.id
      // 2. INSERT triggers (on_task_created, set_task_number) that add extra rows
      //    to task_activity_log and task_status_history — we don't want these during migration.

      // Disable INSERT triggers on tasks
      const dis = freshPool();
      try {
        await dis.query('ALTER TABLE tasks DISABLE TRIGGER on_task_created');
        await dis.query('ALTER TABLE tasks DISABLE TRIGGER set_task_number');
        console.log('   ⏸  Disabled tasks INSERT triggers');
      } catch (err) {
        console.log('   ⚠  Could not disable tasks triggers:', err.message);
      } finally { await dis.end(); }

      // First clear extra trigger-generated rows from previous run
      const cleanExtra = freshPool();
      try {
        await cleanExtra.query('DELETE FROM task_status_history');
        await cleanExtra.query('DELETE FROM task_activity_log');
        await cleanExtra.query('DELETE FROM tasks');
        console.log('   ↺  Cleared tasks and related log tables for fresh insert');
      } finally { await cleanExtra.end(); }

      // Step 1: insert all tasks with parent_task_id = NULL
      const rowsNullParent = rows.map(r => ({ ...r, parent_task_id: null }));
      await insertTable(table, rowsNullParent);
      // Step 2: update parent_task_id for rows that had one
      const rowsWithParent = rows.filter(r => r.parent_task_id != null);
      if (rowsWithParent.length > 0) {
        const pool = freshPool();
        try {
          await pool.query('BEGIN');
          for (const r of rowsWithParent) {
            await pool.query('UPDATE tasks SET parent_task_id=$1 WHERE id=$2', [r.parent_task_id, r.id]);
          }
          await pool.query('COMMIT');
          console.log(`   ↑ tasks.parent_task_id updated for ${rowsWithParent.length} rows`);
        } catch (err) {
          await pool.query('ROLLBACK').catch(() => {});
          console.error(`   ✗ tasks parent_task_id update: ${err.message}`);
        } finally { await pool.end(); }
      }
      // Re-enable tasks triggers
      const en = freshPool();
      try {
        await en.query('ALTER TABLE tasks ENABLE TRIGGER on_task_created');
        await en.query('ALTER TABLE tasks ENABLE TRIGGER set_task_number');
        console.log('   ▶  Re-enabled tasks INSERT triggers');
      } catch {}
      finally { await en.end(); }

      continue;
    }

    await insertTable(table, rows);
  }
}

async function syncSequences() {
  console.log('\n🔢 Step 4: Syncing sequences...\n');
  const pool = freshPool();
  try {
    const { rows } = await pool.query(`
      SELECT s.sequence_name, c.table_name, c.column_name
      FROM information_schema.sequences s
      JOIN information_schema.columns c
        ON c.column_default LIKE '%' || s.sequence_name || '%'
      WHERE s.sequence_schema = 'public'
    `);
    for (const { sequence_name, table_name, column_name } of rows) {
      try {
        await pool.query(`
          SELECT setval('${sequence_name}',
            COALESCE((SELECT MAX("${column_name}") FROM "${table_name}"), 1), true)
        `);
        console.log(`   ✓ ${sequence_name}`);
      } catch {}
    }
  } finally { await pool.end(); }
}

// ── Main ───────────────────────────────────────────────────────────────────
console.log('════════════════════════════════════════════════════');
console.log(' TaskFlow — Local → Cloud SQL Migration');
console.log('════════════════════════════════════════════════════');
console.log(' Local: localhost:5433/pruebas_haider');
console.log(' Cloud: 136.116.213.121/planner_db');
console.log('════════════════════════════════════════════════════');

try {
  await applyMigrations();
  await clearCloudData();
  await copyData();
  await syncSequences();
  console.log('\n✅ Migración completada!\n');
} catch (err) {
  console.error('\n✗ Error fatal:', err.message);
  process.exit(1);
} finally {
  await LOCAL.end();
}
