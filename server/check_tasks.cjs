const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'pruebas_haider',
  user: 'postgres',
  password: 'postgres',
});

async function check() {
  await client.connect();

  const userResult = await client.query(
    'SELECT u.id as user_id, u.email, p.id as profile_id FROM public.users u JOIN public.profiles p ON p.user_id = u.id WHERE u.email = $1',
    ['nathaly_amaya@cun.edu.co']
  );
  console.log('Nathaly Profile ID:', userResult.rows[0].profile_id);

  const profileId = userResult.rows[0].profile_id;

  const tasksResult = await client.query(
    'SELECT id, title, reporter_id, parent_task_id FROM public.tasks WHERE reporter_id = $1 ORDER BY created_at DESC LIMIT 5',
    [profileId]
  );
  console.log('\n📝 Tasks created by Nathaly:', tasksResult.rows.length);
  tasksResult.rows.forEach(task => {
    console.log('  • Title:', task.title);
    console.log('    Parent:', task.parent_task_id || 'NULL (original task)');
  });

  const allTasksResult = await client.query(
    'SELECT title, reporter_id, parent_task_id FROM public.tasks ORDER BY created_at DESC LIMIT 3'
  );
  console.log('\n📋 Recent tasks (all):');
  allTasksResult.rows.forEach(task => {
    const isNathaly = task.reporter_id === profileId;
    console.log('  • Title:', task.title);
    console.log('    Reporter:', isNathaly ? 'Nathaly ✓' : 'Other user');
    console.log('    Type:', task.parent_task_id ? 'Copy' : 'Original');
  });

  await client.end();
}

check().catch(console.error);
