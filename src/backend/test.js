const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: '1',
  host: 'localhost',
  database: 'db',
  port: 5432,
});

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL!');
    const res = await client.query('SELECT NOW()');
    console.log('⏰ Current time:', res.rows[0].now);
    client.release();
  } catch (err) {
    console.error('❌ Connection failed:', err);
  } finally {
    await pool.end();
  }
}

testConnection();