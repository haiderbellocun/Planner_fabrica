// fix-merge-danna.js
// Migra tareas del perfil Gmail al perfil CUN y elimina la cuenta duplicada
// Ejecutar en producción: node fix-merge-danna.js

require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Busca por email — no necesitas el ID completo
const GMAIL_EMAIL = 'danna_fierro@gmail.com';
const CUN_EMAIL   = 'danna_fierro@cun.edu.co';

async function main() {
  const client = await pool.connect();
  try {
    // ─── 0. Obtener los dos profile_ids por email ─────────────────────────────
    const profilesRes = await client.query(`
      SELECT p.id AS profile_id, p.full_name, u.email, u.id AS user_id, u.is_active
      FROM public.profiles p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.email = $1 OR u.email = $2
    `, [GMAIL_EMAIL, CUN_EMAIL]);

    console.log('\n📋 Perfiles encontrados:');
    console.table(profilesRes.rows.map(r => ({
      user_id: r.user_id,
      email: r.email,
      profile_id: r.profile_id,
      is_active: r.is_active,
    })));

    const gmailProfile = profilesRes.rows.find(r => r.email === GMAIL_EMAIL);
    const cunProfile   = profilesRes.rows.find(r => r.email === CUN_EMAIL);

    if (!gmailProfile || !cunProfile) {
      console.error('❌ No se encontraron ambos perfiles. Verifica los emails.');
      return;
    }

    const FROM_PROFILE = gmailProfile.profile_id;
    const TO_PROFILE   = cunProfile.profile_id;

    console.log(`\n🔄 Migrando de: ${FROM_PROFILE} (${gmailProfile.email})`);
    console.log(`           a:  ${TO_PROFILE} (${cunProfile.email})\n`);

    // ─── 1. Contar antes ─────────────────────────────────────────────────────
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM public.tasks WHERE assignee_id = $1) AS tasks,
        (SELECT COUNT(*) FROM public.task_material_assignees WHERE assignee_id = $1) AS tma,
        (SELECT COUNT(*) FROM public.task_tema_assignees WHERE assignee_id = $1) AS tta,
        (SELECT COUNT(*) FROM public.notifications WHERE user_id = $1) AS notifs
    `, [FROM_PROFILE]);
    console.log('📊 Registros a migrar:', counts.rows[0]);

    // ─── 2. TRANSACCIÓN: migrar todo ────────────────────────────────────────
    await client.query('BEGIN');

    const t1 = await client.query(
      'UPDATE public.tasks SET assignee_id = $1 WHERE assignee_id = $2 RETURNING id',
      [TO_PROFILE, FROM_PROFILE]
    );
    console.log(`✅ tasks migradas: ${t1.rowCount}`);

    const t2 = await client.query(
      'UPDATE public.task_material_assignees SET assignee_id = $1 WHERE assignee_id = $2 RETURNING id',
      [TO_PROFILE, FROM_PROFILE]
    );
    console.log(`✅ task_material_assignees migradas: ${t2.rowCount}`);

    const t3 = await client.query(
      'UPDATE public.task_tema_assignees SET assignee_id = $1 WHERE assignee_id = $2 RETURNING id',
      [TO_PROFILE, FROM_PROFILE]
    );
    console.log(`✅ task_tema_assignees migradas: ${t3.rowCount}`);

    const t4 = await client.query(
      'UPDATE public.notifications SET user_id = $1 WHERE user_id = $2 RETURNING id',
      [TO_PROFILE, FROM_PROFILE]
    );
    console.log(`✅ notificaciones migradas: ${t4.rowCount}`);

    // ─── 3. Borrar perfil y usuario Gmail ───────────────────────────────────
    const d1 = await client.query(
      'DELETE FROM public.profiles WHERE id = $1 RETURNING id',
      [FROM_PROFILE]
    );
    console.log(`🗑  perfil Gmail eliminado: ${d1.rowCount}`);

    const d2 = await client.query(
      'DELETE FROM public.users WHERE email = $1 RETURNING id',
      [GMAIL_EMAIL]
    );
    console.log(`🗑  usuario Gmail eliminado: ${d2.rowCount}`);

    await client.query('COMMIT');
    console.log('\n✅ MIGRACIÓN COMPLETADA. Danna ahora solo tiene la cuenta CUN.');

    // ─── 4. Verificar ────────────────────────────────────────────────────────
    const verify = await client.query(`
      SELECT t.title, ts.name as status
      FROM public.tasks t
      JOIN public.task_statuses ts ON ts.id = t.status_id
      WHERE t.assignee_id = $1
    `, [TO_PROFILE]);
    console.log(`\n📋 Tareas de Danna (perfil CUN) ahora:`);
    console.table(verify.rows);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ERROR — se hizo ROLLBACK, no se cambió nada:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

main();
