import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('../server/node_modules/pg');

const LOCAL = new Pool({ host: 'localhost', port: 5433, database: 'pruebas_haider', user: 'postgres', password: 'postgres' });
const CLOUD = new Pool({ host: '136.116.213.121', port: 5432, database: 'planner_db', user: 'planner_user', password: 'h4ider9103##', ssl: { rejectUnauthorized: false }, max: 1 });

// Get one profile from local
const { rows: [prof] } = await LOCAL.query("SELECT * FROM profiles WHERE email='danna_poveda@cun.edu.co'");
console.log('Local profile:', { id: prof.id, user_id: prof.user_id, email: prof.email });

// Check user in Cloud
const { rows: users } = await CLOUD.query('SELECT id FROM users WHERE id=$1', [prof.user_id]);
console.log('User in Cloud SQL:', users[0]?.id || 'NOT FOUND');

// Clear and re-insert
await CLOUD.query("DELETE FROM profiles WHERE email='danna_poveda@cun.edu.co'");

const columns = Object.keys(prof);
const values = columns.map(c => prof[c]);
const ph = values.map((_, i) => `$${i + 1}`).join(',');
const cl = columns.map(c => `"${c}"`).join(',');

try {
  await CLOUD.query(`INSERT INTO profiles (${cl}) VALUES (${ph})`, values);
  const { rows: [res] } = await CLOUD.query("SELECT id FROM profiles WHERE email='danna_poveda@cun.edu.co'");
  console.log('After insert ID:', res?.id);
  console.log('IDs match:', prof.id === res?.id);
} catch (e) {
  console.error('Insert error:', e.message);
}

await LOCAL.end();
await CLOUD.end();
