require('dotenv').config();
const { Client } = require('pg');

async function updateProjectLeaders() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'pruebas_haider',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Get profile IDs for the 4 users
    const emails = [
      'haider_bello@cun.edu.co',
      'deyvis_miranda@cun.edu.co',
      'german_giraldo@cun.edu.co',
      'nathaly_amaya@cun.edu.co'
    ];

    const profilesResult = await client.query(
      `SELECT p.id, u.email, u.full_name
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE u.email = ANY($1)`,
      [emails]
    );

    console.log('Found profiles:');
    profilesResult.rows.forEach(p => {
      console.log(`  - ${p.full_name} (${p.email})`);
    });

    const profileIds = profilesResult.rows.map(p => p.id);

    // Update all existing project_members to make these users leaders
    const updateResult = await client.query(
      `UPDATE project_members
       SET role = 'leader'
       WHERE user_id = ANY($1)
       RETURNING project_id, user_id`,
      [profileIds]
    );

    console.log(`\n✅ Updated ${updateResult.rowCount} project memberships to leader role`);

    // Show current project members
    const membersResult = await client.query(
      `SELECT
        pr.name as project_name,
        u.full_name,
        u.email,
        pm.role
       FROM project_members pm
       JOIN profiles p ON p.id = pm.user_id
       JOIN users u ON u.id = p.user_id
       JOIN projects pr ON pr.id = pm.project_id
       ORDER BY pr.name, pm.role DESC, u.full_name`
    );

    console.log('\nCurrent project memberships:');
    let currentProject = '';
    membersResult.rows.forEach(m => {
      if (m.project_name !== currentProject) {
        currentProject = m.project_name;
        console.log(`\n📁 ${m.project_name}:`);
      }
      console.log(`  - ${m.full_name} (${m.email}): ${m.role}`);
    });

    await client.end();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('Error:', error);
    await client.end();
    process.exit(1);
  }
}

updateProjectLeaders();
