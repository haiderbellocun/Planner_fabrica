const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'pruebas_haider',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function getProfileIds() {
  try {
    const emails = [
      'haider_bello@cun.edu.co',
      'deyvis_miranda@cun.edu.co',
      'german_giraldo@cun.edu.co',
      'nathaly_amaya@cun.edu.co'
    ];

    console.log('Buscando profile IDs para los usuarios...\n');

    for (const email of emails) {
      const result = await pool.query(`
        SELECT u.id as user_id, u.email, p.id as profile_id
        FROM public.users u
        LEFT JOIN public.profiles p ON p.user_id = u.id
        WHERE u.email = $1
      `, [email]);

      if (result.rows.length > 0) {
        const user = result.rows[0];
        console.log(`${email}:`);
        console.log(`  user_id: ${user.user_id}`);
        console.log(`  profile_id: ${user.profile_id}`);
        console.log('');
      } else {
        console.log(`${email}: NO ENCONTRADO\n`);
      }
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

getProfileIds();
