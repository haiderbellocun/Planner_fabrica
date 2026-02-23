require('dotenv').config();
const { Client } = require('pg');

async function fixNathalyTasks() {
  const client = new Client({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT) || 5433,
    database: process.env.PGDATABASE || 'pruebas_haider',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Step 1: Find Nathaly's profile
    console.log('=== STEP 1: Finding Nathaly\'s profile ===');
    const profileResult = await client.query(
      `SELECT p.id AS profile_id, u.id AS user_id, u.email, u.full_name
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE u.full_name ILIKE '%nathaly%'`
    );

    if (profileResult.rows.length === 0) {
      console.log('No profile found for Nathaly. Exiting.');
      return;
    }

    console.log('Profiles found:');
    profileResult.rows.forEach(r => {
      console.log(`  Profile ID: ${r.profile_id}, User ID: ${r.user_id}, Name: ${r.full_name}, Email: ${r.email}`);
    });

    const nathalyProfileId = profileResult.rows[0].profile_id;
    console.log(`\nUsing profile_id: ${nathalyProfileId}\n`);

    // Step 2: Check if she's a leader in project_members
    console.log('=== STEP 2: Checking project_members role ===');
    const memberResult = await client.query(
      `SELECT pm.id, pm.project_id, pm.role, p.name AS project_name
       FROM project_members pm
       JOIN projects p ON p.id = pm.project_id
       WHERE pm.user_id = $1`,
      [nathalyProfileId]
    );

    if (memberResult.rows.length === 0) {
      console.log('Nathaly is not a member of any project.');
    } else {
      console.log('Project memberships:');
      memberResult.rows.forEach(r => {
        console.log(`  Project: "${r.project_name}" (ID: ${r.project_id}), Role: ${r.role}`);
      });
    }

    const isLeader = memberResult.rows.some(r => r.role === 'leader' || r.role === 'project_leader');
    console.log(`\nIs project leader? ${isLeader}\n`);

    // Step 3: Find level 3 tasks assigned to Nathaly
    // Level 3 = tasks whose parent_task_id points to a "copy task" (which itself has a parent_task_id)
    console.log('=== STEP 3: Finding level 3 user tasks assigned to Nathaly ===');
    const tasksResult = await client.query(
      `SELECT 
         t.id AS task_id,
         t.title AS task_title,
         t.status_id,
         t.assignee_id,
         t.parent_task_id,
         t.project_id,
         parent.id AS parent_id,
         parent.title AS parent_title,
         parent.parent_task_id AS grandparent_id,
         grandparent.title AS grandparent_title,
         proj.name AS project_name
       FROM tasks t
       JOIN tasks parent ON parent.id = t.parent_task_id
       JOIN tasks grandparent ON grandparent.id = parent.parent_task_id
       JOIN projects proj ON proj.id = t.project_id
       WHERE t.assignee_id = $1
         AND t.parent_task_id IS NOT NULL
         AND parent.parent_task_id IS NOT NULL`,
      [nathalyProfileId]
    );

    if (tasksResult.rows.length === 0) {
      console.log('No level 3 tasks found assigned to Nathaly. Nothing to delete.');
      return;
    }

    console.log(`Found ${tasksResult.rows.length} level 3 task(s) assigned to Nathaly:\n`);
    tasksResult.rows.forEach(r => {
      console.log(`  Task ID: ${r.task_id}`);
      console.log(`    Title: "${r.task_title}"`);
      console.log(`    Status ID: ${r.status_id}`);
      console.log(`    Project: "${r.project_name}" (ID: ${r.project_id})`);
      console.log(`    Parent (copy task): "${r.parent_title}" (ID: ${r.parent_id})`);
      console.log(`    Grandparent (master): "${r.grandparent_title}" (ID: ${r.grandparent_id})`);
      console.log('');
    });

    const taskIds = tasksResult.rows.map(r => r.task_id);
    console.log(`Task IDs to delete: [${taskIds.join(', ')}]\n`);

    // Step 4: Delete the tasks
    console.log('=== STEP 4: Deleting level 3 tasks ===');

    // First check if any of these tasks have children
    const childrenCheck = await client.query(
      `SELECT id, title, parent_task_id FROM tasks WHERE parent_task_id = ANY($1::uuid[])`,
      [taskIds]
    );

    if (childrenCheck.rows.length > 0) {
      console.log(`WARNING: ${childrenCheck.rows.length} child task(s) found under these tasks. Deleting children first...`);
      const childIds = childrenCheck.rows.map(r => r.id);
      await client.query('DELETE FROM tasks WHERE id = ANY($1::uuid[])', [childIds]);
      console.log(`  Deleted ${childIds.length} child task(s).`);
    }

    // Also delete comments referencing these tasks if comments table exists
    try {
      const commentsDel = await client.query(
        `DELETE FROM comments WHERE task_id = ANY($1::uuid[])`,
        [taskIds]
      );
      if (commentsDel.rowCount > 0) {
        console.log(`  Deleted ${commentsDel.rowCount} comment(s) referencing these tasks.`);
      }
    } catch (e) {
      // comments table might not exist or no FK, continue
    }

    const deleteResult = await client.query(
      'DELETE FROM tasks WHERE id = ANY($1::uuid[])',
      [taskIds]
    );

    console.log(`\nSuccessfully deleted ${deleteResult.rowCount} task(s).\n`);

    // Verification
    console.log('=== VERIFICATION ===');
    const verifyResult = await client.query(
      `SELECT t.id, t.title
       FROM tasks t
       JOIN tasks parent ON parent.id = t.parent_task_id
       WHERE t.assignee_id = $1
         AND t.parent_task_id IS NOT NULL
         AND parent.parent_task_id IS NOT NULL`,
      [nathalyProfileId]
    );
    console.log(`Remaining level 3 tasks for Nathaly: ${verifyResult.rows.length}`);
    if (verifyResult.rows.length === 0) {
      console.log('All incorrect user tasks have been removed.');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed.');
  }
}

fixNathalyTasks();
