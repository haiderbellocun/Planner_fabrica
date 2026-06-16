/**
 * Backfill duration_seconds en task_status_history
 *
 * Calcula la duración para todos los registros donde:
 *   - ended_at IS NOT NULL  (la transición ya cerró)
 *   - duration_seconds IS NULL  (no fue calculado por el trigger)
 *
 * Uso:
 *   node server/run-backfill-duration.mjs           → muestra diagnóstico
 *   node server/run-backfill-duration.mjs --fix     → aplica el backfill
 *   node server/run-backfill-duration.mjs --trigger → (re)instala el trigger también
 */

import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cargar .env del directorio server/
const envPath = join(__dirname, '.env');
try {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.error('No se encontró server/.env — asegúrate de ejecutar desde la raíz del proyecto');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const FIX     = process.argv.includes('--fix');
const TRIGGER = process.argv.includes('--trigger');

async function run() {
  const client = await pool.connect();
  try {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  Diagnóstico: task_status_history.duration_seconds');
    console.log('═══════════════════════════════════════════════════\n');

    // ── 1. Totales ────────────────────────────────────────────────────────
    const totals = await client.query(`
      SELECT
        COUNT(*)                                        AS total,
        COUNT(*) FILTER (WHERE ended_at IS NOT NULL)   AS cerrados,
        COUNT(*) FILTER (WHERE ended_at IS NULL)        AS abiertos,
        COUNT(*) FILTER (
          WHERE ended_at IS NOT NULL AND duration_seconds IS NOT NULL
        )                                               AS con_duracion,
        COUNT(*) FILTER (
          WHERE ended_at IS NOT NULL AND duration_seconds IS NULL
        )                                               AS sin_duracion_cerrados
      FROM public.task_status_history
    `);
    const t = totals.rows[0];
    console.log(`Total registros          : ${t.total}`);
    console.log(`  Cerrados (ended_at ≠ NULL): ${t.cerrados}`);
    console.log(`    ✅ Con duration_seconds  : ${t.con_duracion}`);
    console.log(`    ❌ Sin duration_seconds  : ${t.sin_duracion_cerrados}  ← estos necesitan backfill`);
    console.log(`  Abiertos (ended_at IS NULL): ${t.abiertos}   ← normal, sin duración aún`);

    // ── 2. Verificar trigger ──────────────────────────────────────────────
    const trig = await client.query(`
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers
      WHERE event_object_table = 'tasks'
        AND trigger_name IN ('on_task_status_change', 'on_task_created')
    `);
    console.log('\n── Triggers en tabla tasks ──────────────────────────');
    if (trig.rows.length === 0) {
      console.log('  ⚠️  NO se encontraron triggers. Los cambios futuros tampoco calcularán duration_seconds.');
    } else {
      trig.rows.forEach(r => {
        console.log(`  ✅ ${r.trigger_name} (${r.action_timing} ${r.event_manipulation})`);
      });
    }

    if (parseInt(t.sin_duracion_cerrados) === 0) {
      console.log('\n✅ No hay registros que necesiten backfill. Todo OK.\n');
      return;
    }

    // ── 3. Preview de filas a actualizar ──────────────────────────────────
    const preview = await client.query(`
      SELECT
        tsh.id,
        tsh.started_at,
        tsh.ended_at,
        EXTRACT(EPOCH FROM (tsh.ended_at - tsh.started_at))::INTEGER AS computed_seconds,
        ts.name AS from_status
      FROM public.task_status_history tsh
      LEFT JOIN public.task_statuses ts ON ts.id = tsh.from_status_id
      WHERE tsh.ended_at IS NOT NULL AND tsh.duration_seconds IS NULL
      ORDER BY tsh.started_at DESC
      LIMIT 5
    `);
    console.log('\n── Muestra de los primeros 5 registros a actualizar ─');
    preview.rows.forEach(r => {
      const h = (r.computed_seconds / 3600).toFixed(2);
      console.log(`  [${r.from_status ?? 'inicial'}] ${r.started_at?.toISOString?.() ?? '—'} → ${r.ended_at?.toISOString?.() ?? '—'} = ${r.computed_seconds}s (${h}h)`);
    });

    if (!FIX) {
      console.log(`\n⚠️  Modo SOLO LECTURA. Para aplicar el backfill ejecuta:`);
      console.log(`   node server/run-backfill-duration.mjs --fix\n`);
      return;
    }

    // ── 4. Aplicar backfill ───────────────────────────────────────────────
    console.log('\n── Aplicando backfill…');
    await client.query('BEGIN');

    const upd = await client.query(`
      UPDATE public.task_status_history
      SET duration_seconds = EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
      WHERE ended_at IS NOT NULL
        AND duration_seconds IS NULL
        AND started_at IS NOT NULL
        AND ended_at > started_at
    `);
    console.log(`  ✅ Actualizados: ${upd.rowCount} registros`);

    // Verificar que no hayan quedado negativos
    const neg = await client.query(`
      SELECT COUNT(*) AS cnt
      FROM public.task_status_history
      WHERE duration_seconds IS NOT NULL AND duration_seconds < 0
    `);
    if (parseInt(neg.rows[0].cnt) > 0) {
      console.log(`  ⚠️  Hay ${neg.rows[0].cnt} registros con duración negativa (ended_at < started_at). Corrigiendo a 0…`);
      await client.query(`
        UPDATE public.task_status_history
        SET duration_seconds = 0
        WHERE duration_seconds < 0
      `);
    }

    await client.query('COMMIT');
    console.log('  ✅ COMMIT exitoso\n');

    // ── 5. Resumen final ──────────────────────────────────────────────────
    const after = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE ended_at IS NOT NULL AND duration_seconds IS NOT NULL) AS con_dur,
        COUNT(*) FILTER (WHERE ended_at IS NOT NULL AND duration_seconds IS NULL)     AS sin_dur,
        ROUND(AVG(duration_seconds) FILTER (WHERE duration_seconds > 0) / 3600.0, 2) AS avg_horas
      FROM public.task_status_history
    `);
    const a = after.rows[0];
    console.log('── Estado después del backfill ──────────────────────');
    console.log(`  ✅ Con duration_seconds: ${a.con_dur}`);
    console.log(`  ❌ Sin duration_seconds: ${a.sin_dur}`);
    console.log(`  Promedio global        : ${a.avg_horas}h por estado\n`);

    // ── 6. (Re)instalar trigger si se pidió ───────────────────────────────
    if (TRIGGER) {
      console.log('── Reinstalando trigger on_task_status_change…');
      await client.query(`
        CREATE OR REPLACE FUNCTION public.track_task_status_change()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        BEGIN
          IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
            UPDATE public.task_status_history
            SET ended_at = now(),
                duration_seconds = EXTRACT(EPOCH FROM (now() - started_at))::INTEGER
            WHERE task_id = NEW.id AND ended_at IS NULL;

            INSERT INTO public.task_status_history
              (task_id, from_status_id, to_status_id, changed_by, started_at)
            VALUES (NEW.id, OLD.status_id, NEW.status_id, NEW.reporter_id, now());
          END IF;
          RETURN NEW;
        END;
        $$;

        DROP TRIGGER IF EXISTS on_task_status_change ON public.tasks;
        CREATE TRIGGER on_task_status_change
          AFTER UPDATE ON public.tasks
          FOR EACH ROW EXECUTE FUNCTION public.track_task_status_change();
      `);
      console.log('  ✅ Trigger reinstalado\n');
    }

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
