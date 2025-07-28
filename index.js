const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const userRoutes = require('./routes/user');
const authRoutes = require('./routes/auth');

app.use(cors());
app.use(express.json());

// ✅ Add this test route to check if backend is working
app.get("/", (req, res) => {
  res.status(200).json({ message: "✅ Backend is live and working!" });
});

// Main user API route
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);

// For managed PostgreSQL (e.g. Neon, Heroku, Railway, Render), SSL is required.
// rejectUnauthorized: false allows self-signed certificates (safe for managed DBs, not for production on your own server).
// If you use Pool or Client elsewhere, use this config:
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // required for Neon or other managed PostgreSQL
  },
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
