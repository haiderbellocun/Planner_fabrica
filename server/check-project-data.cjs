const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'pruebas_haider',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkProjectData() {
  try {
    // Get project
    console.log('📊 Buscando proyecto "pruna_12_02_2025"...\n');
    const project = await pool.query(`
      SELECT * FROM public.projects
      WHERE name ILIKE '%pruna%' OR key ILIKE '%1202%'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (project.rows.length === 0) {
      console.log('❌ No se encontró el proyecto\n');
      await pool.end();
      return;
    }

    const projectData = project.rows[0];
    console.log('✅ Proyecto encontrado:');
    console.log(`   ID: ${projectData.id}`);
    console.log(`   Nombre: ${projectData.name}`);
    console.log(`   Key: ${projectData.key}\n`);

    // Get programas
    console.log('📋 Programas del proyecto:\n');
    const programas = await pool.query(`
      SELECT * FROM public.programas
      WHERE project_id = $1
      ORDER BY display_order
    `, [projectData.id]);

    if (programas.rows.length === 0) {
      console.log('   ⚠️ No hay programas\n');
    } else {
      for (const programa of programas.rows) {
        console.log(`   - ${programa.name} (${programa.code || 'sin código'})`);
        console.log(`     ID: ${programa.id}`);
        console.log(`     Tipo: ${programa.tipo_programa || 'no especificado'}\n`);

        // Get asignaturas for this programa
        const asignaturas = await pool.query(`
          SELECT * FROM public.asignaturas
          WHERE programa_id = $1
          ORDER BY display_order
        `, [programa.id]);

        if (asignaturas.rows.length === 0) {
          console.log('     ⚠️ No hay asignaturas en este programa\n');
        } else {
          console.log(`     📚 Asignaturas (${asignaturas.rows.length}):`);
          for (const asignatura of asignaturas.rows) {
            console.log(`       • ${asignatura.name} (${asignatura.code || 'sin código'})`);
            console.log(`         ID: ${asignatura.id}`);
            console.log(`         Semestre: ${asignatura.semestre || 'no especificado'}`);

            // Get materiales for this asignatura
            const materiales = await pool.query(`
              SELECT mr.*, mt.name as material_name, mt.description as material_description
              FROM public.materiales_requeridos mr
              JOIN public.material_types mt ON mt.id = mr.material_type_id
              WHERE mr.asignatura_id = $1
            `, [asignatura.id]);

            if (materiales.rows.length === 0) {
              console.log('         ⚠️ No hay materiales para esta asignatura');
            } else {
              console.log(`         📦 Materiales (${materiales.rows.length}):`);
              materiales.rows.forEach(mat => {
                console.log(`           - ${mat.material_description} (cantidad: ${mat.cantidad})`);
              });
            }
            console.log('');
          }
        }
      }
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkProjectData();
