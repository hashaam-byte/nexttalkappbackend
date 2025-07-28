require('dotenv').config();
const { Pool } = require('pg');

console.log('Connecting to:', process.env.DATABASE_URL); // Debug log

// For managed PostgreSQL (e.g. Neon, Heroku, Railway, Render), SSL is required.
// rejectUnauthorized: false allows self-signed certificates (safe for managed DBs, not for production on your own server).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // required for Neon or other managed PostgreSQL
  },
});

async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', res.rows[0]);
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  } finally {
    await pool.end(); // ensure clean exit
  }
}

testConnection();
