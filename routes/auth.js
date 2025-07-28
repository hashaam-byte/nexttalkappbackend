const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verifyToken = require('../middleware/verifyToken');

// For managed PostgreSQL (e.g. Neon, Heroku, Railway, Render), SSL is required.
// rejectUnauthorized: false allows self-signed certificates (safe for managed DBs, not for production on your own server).
// If you use Pool or Client here, use:
// const { Pool } = require('pg');
// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: { rejectUnauthorized: false },
// });

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', verifyToken, authController.me);

module.exports = router;
