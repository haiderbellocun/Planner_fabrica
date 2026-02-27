import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost', port: 5433,
  database: 'pruebas_haider',
  user: 'postgres', password: 'postgres'
});

const { rows } = await pool.query(
  `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
);

console.log('=== Tablas en pruebas_haider local ===');
for (const { tablename } of rows) {
  const r = await pool.query(`SELECT COUNT(*) as n FROM "${tablename}"`);
  console.log(tablename.padEnd(45), r.rows[0].n + ' filas');
}

await pool.end();
