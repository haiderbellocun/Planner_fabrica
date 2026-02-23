const XLSX = require('xlsx');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const workbook = XLSX.readFile('../HACER UN LISTADO (3).xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

async function importUsers() {
  const client = new Client({ host: 'localhost', port: 5433, database: 'pruebas_haider', user: 'postgres', password: 'postgres' });
  await client.connect();

  // First clean up any partial imports
  console.log('Limpiando importaciones parciales...');
  await client.query('DELETE FROM public.user_roles WHERE user_id NOT IN (SELECT id FROM public.profiles)');

  console.log('Importando', data.length, 'usuarios...\n');

  let created = 0, skipped = 0;

  for (const row of data) {
    const email = (row['Correo Electrónico'] || '').trim().toLowerCase();
    const fullName = (row['Nombre'] || '').trim();
    const cedula = String(row['Cédula'] || '').trim();
    const cargo = (row['Cargo'] || '').trim();

    if (!email || !fullName) {
      console.log('SKIP (sin datos):', row);
      skipped++;
      continue;
    }

    // Check if user already exists
    const existing = await client.query('SELECT id FROM public.users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log('SKIP (existe):', email);
      skipped++;
      continue;
    }

    // Hash password (cédula)
    const passwordHash = await bcrypt.hash(cedula, 10);

    // Insert user (trigger may auto-create profile)
    const userResult = await client.query(
      'INSERT INTO public.users (email, password_hash, full_name, is_active) VALUES ($1, $2, $3, true) RETURNING id',
      [email, passwordHash, fullName]
    );
    const userId = userResult.rows[0].id;

    // Check if profile was auto-created by trigger, if not create it
    let profileResult = await client.query(
      'SELECT id FROM public.profiles WHERE user_id = $1',
      [userId]
    );

    if (profileResult.rows.length === 0) {
      profileResult = await client.query(
        'INSERT INTO public.profiles (user_id, full_name, email) VALUES ($1, $2, $3) RETURNING id',
        [userId, fullName, email]
      );
    }
    const profileId = profileResult.rows[0].id;

    // Assign role 'user' (check if not already assigned)
    const roleExists = await client.query(
      'SELECT id FROM public.user_roles WHERE user_id = $1',
      [profileId]
    );
    if (roleExists.rows.length === 0) {
      await client.query(
        "INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'user')",
        [profileId]
      );
    }

    console.log('OK:', fullName, '(' + email + ') - Pass:', cedula);
    created++;
  }

  console.log('\n--- RESUMEN ---');
  console.log('Creados:', created);
  console.log('Saltados:', skipped);
  console.log('Total:', data.length);

  await client.end();
}

importUsers().catch(e => console.error('Error:', e.message));
