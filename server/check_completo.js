// Check asignaturas for completo project
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'pruebas_haider',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function check() {
  try {
    // Get project id for 'completo'
    const project = await pool.query(`SELECT id, name FROM public.projects WHERE name = 'completo'`);

    if (project.rows.length === 0) {
      console.log('Project "completo" not found');
      return;
    }

    console.log('Project:', project.rows[0].name);
    console.log('Project ID:', project.rows[0].id);

    // Check all asignaturas for this project
    const asigs = await pool.query(`
      SELECT id, name, code, created_at, display_order
      FROM public.asignaturas
      WHERE project_id = $1
      ORDER BY created_at ASC
    `, [project.rows[0].id]);

    console.log('\n=== Asignaturas encontradas:', asigs.rows.length, '===');
    asigs.rows.forEach((a, i) => {
      console.log(`${i+1}. ${a.name} (${a.code}) - creado: ${a.created_at}`);
    });

    // Check if there are any deleted or orphaned asignaturas
    const allAsigs = await pool.query(`
      SELECT a.id, a.name, a.code, a.project_id, p.name as project_name
      FROM public.asignaturas a
      LEFT JOIN public.projects p ON p.id = a.project_id
      WHERE a.name LIKE '%mate%' OR a.name LIKE '%ingles%'
      ORDER BY a.created_at DESC
    `);

    console.log('\n=== Todas las asignaturas relacionadas (mate/ingles) ===');
    allAsigs.rows.forEach(a => {
      console.log(`- ${a.name} (${a.code}) en proyecto: ${a.project_name || 'SIN PROYECTO'}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

check();
