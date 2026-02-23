require('dotenv').config();
const { Client } = require('pg');

async function checkDeyvis() {
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

    // Get Deyvis profile
    const profileResult = await client.query(
      `SELECT p.id, u.email, u.full_name
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE u.email = $1`,
      ['deyvis_miranda@cun.edu.co']
    );
    console.log('Deyvis Profile:', profileResult.rows[0]);

    // Get completovs2 project
    const projectResult = await client.query(
      `SELECT id, name FROM projects WHERE name = $1`,
      ['completovs2']
    );
    console.log('\nProject completovs2:', projectResult.rows[0]);

    if (profileResult.rows[0] && projectResult.rows[0]) {
      const profileId = profileResult.rows[0].id;
      const projectId = projectResult.rows[0].id;

      // Check project members
      const membersResult = await client.query(
        `SELECT pm.role, pm.user_id as profile_id, u.email, p.full_name
         FROM project_members pm
         JOIN profiles p ON p.id = pm.user_id
         JOIN users u ON u.id = p.user_id
         WHERE pm.project_id = $1`,
        [projectId]
      );
      console.log('\nProject Members:');
      membersResult.rows.forEach(member => {
        console.log(`  - ${member.full_name} (${member.email}): ${member.role}`);
      });

      // Check if Deyvis is leader
      const leaderResult = await client.query(
        `SELECT public.is_project_leader($1::UUID, $2::UUID) as is_leader`,
        [projectId, profileId]
      );
      console.log('\nIs Deyvis leader of this project?', leaderResult.rows[0].is_leader);
    }

    await client.end();
  } catch (error) {
    console.error('Error:', error);
    await client.end();
    process.exit(1);
  }
}

checkDeyvis();
