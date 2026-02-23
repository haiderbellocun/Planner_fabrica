import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'pruebas_haider',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Cun2023@postgres',
});

async function checkRole() {
  try {
    const result = await pool.query(`
      SELECT u.id, u.email, p.id as profile_id, ur.role
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      LEFT JOIN user_roles ur ON ur.user_id = p.id
      WHERE u.email = 'haider_bello@cun.edu.co'
    `);

    console.log('User data:', JSON.stringify(result.rows, null, 2));

    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('\n=== User Info ===');
      console.log('User ID:', user.id);
      console.log('Email:', user.email);
      console.log('Profile ID:', user.profile_id);
      console.log('Role:', user.role || 'NO ROLE ASSIGNED');
    } else {
      console.log('User not found!');
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

checkRole();
