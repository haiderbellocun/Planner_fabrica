require('dotenv').config();
const { Client } = require('pg');

async function cleanupOldData() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'pruebas_haider',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('🧹 Limpiando datos antiguos...\n');

    // 1. Contar asignaturas antiguas (que tienen project_id pero no programa_id)
    const oldAsignaturasCount = await client.query(`
      SELECT COUNT(*) as count
      FROM public.asignaturas
      WHERE project_id IS NOT NULL AND programa_id IS NULL
    `);
    console.log(`📊 Asignaturas antiguas encontradas: ${oldAsignaturasCount.rows[0].count}`);

    // 2. Contar materiales antiguos (que tienen asignatura_id pero no tema_id)
    const oldMaterialesCount = await client.query(`
      SELECT COUNT(*) as count
      FROM public.materiales_requeridos
      WHERE asignatura_id IS NOT NULL AND tema_id IS NULL
    `);
    console.log(`📊 Materiales antiguos encontrados: ${oldMaterialesCount.rows[0].count}`);

    // 3. Eliminar materiales antiguos primero (por la foreign key)
    if (parseInt(oldMaterialesCount.rows[0].count) > 0) {
      await client.query(`
        DELETE FROM public.materiales_requeridos
        WHERE asignatura_id IS NOT NULL AND tema_id IS NULL
      `);
      console.log(`✅ ${oldMaterialesCount.rows[0].count} materiales antiguos eliminados`);
    }

    // 4. Eliminar asignaturas antiguas
    if (parseInt(oldAsignaturasCount.rows[0].count) > 0) {
      await client.query(`
        DELETE FROM public.asignaturas
        WHERE project_id IS NOT NULL AND programa_id IS NULL
      `);
      console.log(`✅ ${oldAsignaturasCount.rows[0].count} asignaturas antiguas eliminadas`);
    }

    // 5. Verificar que no quedan datos antiguos
    const remainingOldAsignaturas = await client.query(`
      SELECT COUNT(*) as count
      FROM public.asignaturas
      WHERE project_id IS NOT NULL AND programa_id IS NULL
    `);

    const remainingOldMateriales = await client.query(`
      SELECT COUNT(*) as count
      FROM public.materiales_requeridos
      WHERE asignatura_id IS NOT NULL AND tema_id IS NULL
    `);

    console.log('\n📋 Verificación final:');
    console.log(`  - Asignaturas antiguas restantes: ${remainingOldAsignaturas.rows[0].count}`);
    console.log(`  - Materiales antiguos restantes: ${remainingOldMateriales.rows[0].count}`);

    if (remainingOldAsignaturas.rows[0].count === '0' && remainingOldMateriales.rows[0].count === '0') {
      console.log('\n✨ Limpieza completada exitosamente!');
    } else {
      console.log('\n⚠️  Aún quedan datos antiguos por limpiar');
    }

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await client.end();
    process.exit(1);
  }
}

cleanupOldData();
