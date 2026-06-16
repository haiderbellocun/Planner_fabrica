/**
 * Diagnóstico y corrección de roles de usuarios.
 * Uso:
 *   node server/check-roles.mjs           → solo muestra los roles actuales
 *   node server/check-roles.mjs --fix     → corrige duplicados (deja 1 fila por usuario)
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Cargar .env del servidor
const envPath = resolve(__dirname, '.env');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
  if (!process.env[key]) process.env[key] = val;
}

const { Pool } = require('pg');
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME     || 'pruebas_haider',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const shouldFix = process.argv.includes('--fix');

async function main() {
  const client = await pool.connect();
  try {
    // 1. Ver todos los usuarios con su(s) rol(es)
    console.log('\n=== Usuarios y sus roles en user_roles ===\n');
    const allRoles = await client.query(`
      SELECT
        u.email,
        u.full_name,
        u.is_active,
        p.id AS profile_id,
        ur.role,
        ur.id AS role_row_id
      FROM public.users u
      LEFT JOIN public.profiles p ON p.user_id = u.id
      LEFT JOIN public.user_roles ur ON ur.user_id = p.id
      ORDER BY u.full_name, ur.role
    `);

    if (allRoles.rows.length === 0) {
      console.log('No se encontraron usuarios.');
    } else {
      for (const row of allRoles.rows) {
        const activeIcon = row.is_active ? '✅' : '❌';
        const roleStr    = row.role ?? '(sin rol → "user")';
        console.log(`  ${activeIcon} ${row.full_name} <${row.email}> → role: ${roleStr} (profile: ${row.profile_id}, role_row: ${row.role_row_id})`);
      }
    }

    // 2. Detectar duplicados en user_roles
    console.log('\n=== Verificando duplicados en user_roles ===\n');
    const dups = await client.query(`
      SELECT user_id, COUNT(*) AS cnt, array_agg(role ORDER BY role) AS roles
      FROM public.user_roles
      GROUP BY user_id
      HAVING COUNT(*) > 1
    `);

    if (dups.rows.length === 0) {
      console.log('Sin duplicados. Cada profile_id tiene máximo 1 fila en user_roles.\n');
    } else {
      console.log(`⚠️  Encontrados ${dups.rows.length} profile(s) con MÚLTIPLES filas en user_roles:\n`);
      for (const row of dups.rows) {
        console.log(`  profile_id: ${row.user_id} → roles: [${row.roles.join(', ')}] (${row.cnt} filas)`);
      }
      if (shouldFix) {
        console.log('\n→ Corrigiendo duplicados: manteniendo la fila con mayor privilegio...');
        // Para cada duplicado, borrar filas de menor privilegio
        // Orden de privilegio: admin > project_leader > user
        const rankCase = `CASE role WHEN 'admin' THEN 1 WHEN 'project_leader' THEN 2 ELSE 3 END`;
        await client.query(`
          DELETE FROM public.user_roles
          WHERE id IN (
            SELECT id FROM (
              SELECT id, user_id,
                ROW_NUMBER() OVER (
                  PARTITION BY user_id
                  ORDER BY ${rankCase} ASC
                ) AS rn
              FROM public.user_roles
            ) sub
            WHERE rn > 1
          )
        `);
        console.log('✅ Duplicados eliminados.\n');
      } else {
        console.log('\nEjecuta con --fix para eliminar los duplicados.\n');
      }
    }

    // 3. Usuarios sin perfil
    console.log('=== Usuarios sin perfil en profiles ===\n');
    const noProfile = await client.query(`
      SELECT u.email, u.full_name
      FROM public.users u
      LEFT JOIN public.profiles p ON p.user_id = u.id
      WHERE p.id IS NULL
    `);
    if (noProfile.rows.length === 0) {
      console.log('Todos los usuarios tienen perfil. ✅\n');
    } else {
      for (const r of noProfile.rows) {
        console.log(`  ⚠️  ${r.full_name} <${r.email}> → SIN perfil`);
      }
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
