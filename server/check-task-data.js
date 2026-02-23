import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function checkTaskData() {
  try {
    // Get the most recent task
    const taskResult = await pool.query(`
      SELECT id, title, asignatura_id
      FROM public.tasks
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (taskResult.rows.length === 0) {
      console.log('No tasks found');
      return;
    }

    const task = taskResult.rows[0];
    console.log('\n=== MOST RECENT TASK ===');
    console.log('Task ID:', task.id);
    console.log('Title:', task.title);
    console.log('Asignatura ID:', task.asignatura_id);

    if (!task.asignatura_id) {
      console.log('\n❌ Task has NO asignatura_id - this is why temas/materiales are not showing');
      return;
    }

    // Check temas for this asignatura
    const temasResult = await pool.query(`
      SELECT id, title, asignatura_id
      FROM public.temas
      WHERE asignatura_id = $1
      ORDER BY display_order ASC
    `, [task.asignatura_id]);

    console.log('\n=== TEMAS FOR THIS ASIGNATURA ===');
    console.log('Found temas:', temasResult.rows.length);

    if (temasResult.rows.length === 0) {
      console.log('❌ No temas found for this asignatura');
      return;
    }

    // Check materiales for each tema
    for (const tema of temasResult.rows) {
      console.log(`\nTema: ${tema.title} (${tema.id})`);

      const materialesResult = await pool.query(`
        SELECT mr.id, mr.descripcion, mt.name as material_type_name, mt.icon
        FROM public.materiales_requeridos mr
        JOIN public.material_types mt ON mt.id = mr.material_type_id
        WHERE mr.tema_id = $1
      `, [tema.id]);

      console.log(`  - Materiales: ${materialesResult.rows.length}`);
      materialesResult.rows.forEach(m => {
        console.log(`    ${m.icon || '•'} ${m.material_type_name}${m.descripcion ? ': ' + m.descripcion : ''}`);
      });
    }

    console.log('\n✅ Data structure looks good!\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkTaskData();
