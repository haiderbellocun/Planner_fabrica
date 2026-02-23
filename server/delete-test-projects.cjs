require('dotenv').config();
const { Client } = require('pg');

async function deleteTestProjects() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'pruebas_haider',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('🗑️  Eliminando proyectos de prueba...\n');

    // Lista de keys de los proyectos a eliminar
    const projectKeys = [
      'COO',
      'COMPL',
      'PRUE-0004',
      'MOSTRA-202',
      'PRUE-2025',
      'HHHHHH',
      'PRUEMA',
      'PEURUA',
      'GHGH'
    ];

    // También eliminar por nombres parciales
    const projectNamePatterns = [
      'completovs2',
      'completo',
      'proyecto completo',
      'mostrar proyectos',
      'PRUEBA',
      'PRUEBA_materias_material',
      'prueeba_con_materia',
      'prueba con materias',
      'prieuba',
      'ghg'
    ];

    // Primero mostrar los proyectos que se van a eliminar
    const projectsToDelete = await client.query(`
      SELECT id, name, key, description
      FROM public.projects
      WHERE key = ANY($1) OR name = ANY($2)
      ORDER BY created_at DESC
    `, [projectKeys, projectNamePatterns]);

    if (projectsToDelete.rows.length === 0) {
      console.log('✅ No hay proyectos de prueba para eliminar');
      await client.end();
      return;
    }

    console.log(`📋 Proyectos encontrados para eliminar (${projectsToDelete.rows.length}):\n`);
    projectsToDelete.rows.forEach((project, index) => {
      console.log(`${index + 1}. ${project.name} (${project.key})`);
      if (project.description) {
        console.log(`   └─ ${project.description}`);
      }
    });

    console.log('\n⚠️  Eliminando proyectos y todos sus datos relacionados...\n');

    // Eliminar proyectos (las cascadas eliminarán automáticamente):
    // - project_members
    // - tasks
    // - programas
    // - asignaturas
    // - temas
    // - materiales_requeridos
    const result = await client.query(`
      DELETE FROM public.projects
      WHERE key = ANY($1) OR name = ANY($2)
      RETURNING id, name, key
    `, [projectKeys, projectNamePatterns]);

    console.log(`✅ ${result.rows.length} proyectos eliminados:\n`);
    result.rows.forEach((project, index) => {
      console.log(`${index + 1}. ${project.name} (${project.key})`);
    });

    // Verificar que no quedan proyectos de prueba
    const remaining = await client.query(`
      SELECT COUNT(*) as count
      FROM public.projects
      WHERE key = ANY($1) OR name = ANY($2)
    `, [projectKeys, projectNamePatterns]);

    console.log(`\n📊 Proyectos de prueba restantes: ${remaining.rows[0].count}`);

    // Mostrar proyectos restantes
    const allProjects = await client.query(`
      SELECT name, key
      FROM public.projects
      ORDER BY created_at DESC
    `);

    console.log(`\n📋 Proyectos actuales (${allProjects.rows.length}):`);
    allProjects.rows.forEach((project, index) => {
      console.log(`${index + 1}. ${project.name} (${project.key})`);
    });

    await client.end();
    console.log('\n✨ Limpieza completada!\n');
  } catch (error) {
    console.error('❌ Error:', error);
    await client.end();
    process.exit(1);
  }
}

deleteTestProjects();
