// Quick script to check asignaturas in database
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

async function checkAsignaturas() {
  try {
    const result = await pool.query(`
      SELECT
        a.id,
        a.name,
        a.code,
        a.project_id,
        p.name as project_name,
        COUNT(mr.id) as materiales_count
      FROM public.asignaturas a
      LEFT JOIN public.projects p ON p.id = a.project_id
      LEFT JOIN public.materiales_requeridos mr ON mr.asignatura_id = a.id
      GROUP BY a.id, p.name
      ORDER BY a.project_id, a.display_order
    `);

    console.log('Total asignaturas:', result.rows.length);
    console.log('\nAsignaturas by project:');

    const byProject = {};
    result.rows.forEach(row => {
      if (!byProject[row.project_name]) {
        byProject[row.project_name] = [];
      }
      byProject[row.project_name].push(row);
    });

    Object.entries(byProject).forEach(([projectName, asignaturas]) => {
      console.log(`\n${projectName}: ${asignaturas.length} asignaturas`);
      asignaturas.forEach(a => {
        console.log(`  - ${a.name} (${a.code || 'no code'}) - ${a.materiales_count} materiales`);
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAsignaturas();
