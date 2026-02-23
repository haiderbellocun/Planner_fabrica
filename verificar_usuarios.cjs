const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'pruebas_haider',
  user: 'postgres',
  password: 'postgres'
});

async function verificarUsuarios() {
  try {
    // Verificar en users
    const users = await pool.query(
      "SELECT COUNT(*) as total FROM public.users WHERE email LIKE '%@cun.edu.co' OR email LIKE '%@gmail.com'"
    );
    console.log('📊 Tabla public.users:', users.rows[0].total, 'usuarios');

    // Verificar en profiles
    const profiles = await pool.query(
      "SELECT COUNT(*) as total FROM public.profiles WHERE email LIKE '%@cun.edu.co' OR email LIKE '%@gmail.com'"
    );
    console.log('📊 Tabla public.profiles:', profiles.rows[0].total, 'perfiles');

    // Verificar en user_roles
    const roles = await pool.query(
      "SELECT COUNT(*) as total FROM public.user_roles"
    );
    console.log('📊 Tabla public.user_roles:', roles.rows[0].total, 'roles asignados');

    // Mostrar algunos usuarios de ejemplo
    const ejemplos = await pool.query(
      `SELECT u.email, p.full_name, ur.role
       FROM public.users u
       LEFT JOIN public.profiles p ON p.user_id = u.id
       LEFT JOIN public.user_roles ur ON ur.user_id = p.id
       WHERE u.email LIKE '%@cun.edu.co'
       LIMIT 10`
    );

    console.log('\n📋 Ejemplos de usuarios registrados:');
    ejemplos.rows.forEach(row => {
      console.log(`  - ${row.full_name || 'Sin nombre'} (${row.email}) - Rol: ${row.role || 'Sin rol'}`);
    });

    // Buscar usuarios sin profile
    const sinProfile = await pool.query(
      `SELECT COUNT(*) as total
       FROM public.users u
       LEFT JOIN public.profiles p ON p.user_id = u.id
       WHERE p.id IS NULL`
    );
    console.log('\n⚠️  Usuarios sin profile:', sinProfile.rows[0].total);

    // Buscar profiles sin role
    const sinRole = await pool.query(
      `SELECT COUNT(*) as total
       FROM public.profiles p
       LEFT JOIN public.user_roles ur ON ur.user_id = p.id
       WHERE ur.id IS NULL`
    );
    console.log('⚠️  Profiles sin rol:', sinRole.rows[0].total);

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
  }
}

verificarUsuarios();
