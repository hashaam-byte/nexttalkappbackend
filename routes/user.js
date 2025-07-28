const express = require('express');
const router = express.Router();
const db = require('../db');

// Register new user
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO users (username, email, password) VALUES ($1, $2, crypt($3, gen_salt('bf'))) RETURNING *`,
      [username, email, password]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
