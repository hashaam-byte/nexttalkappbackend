const pool = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Utility to create JWT
const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Register User
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Basic validations
    if (!username || username.trim() === '') {
      return res.status(400).json({ message: "Username is required" });
    }
    if (!email || email.trim() === '') {
      return res.status(400).json({ message: "Email is required" });
    }
    if (!password || password.trim() === '') {
      return res.status(400).json({ message: "Password is required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters long" });
    }

    // Check if user already exists
    const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (username, email, password) 
       VALUES ($1, $2, $3) 
       RETURNING id, username, email`,
      [username, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = createToken(user.id);

    res.status(201).json({
      token,
      user
    });

  } catch (e) {
    console.error("Register Error:", e);
    if (e.code === '23505') {
      return res.status(400).json({ message: "User already exists" });
    }
    res.status(500).json({ message: e.message || "Server error" });
  }
};

// Login User
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Basic validations
    if (!email || email.trim() === '') {
      return res.status(400).json({ message: "Email is required" });
    }
    if (!password || password.trim() === '') {
      return res.status(400).json({ message: "Password is required" });
    }

    // Check if user exists
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];

    // Compare passwords
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate token
    const token = createToken(user.id);

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });

  } catch (e) {
    console.error("Login Error:", e);
    res.status(500).json({ message: e.message || "Server error" });
  }
};

// Get Logged-in User Profile
exports.me = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, 
              COALESCE(display_name, '') AS display_name, 
              COALESCE(bio, '') AS bio
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(result.rows[0]);

  } catch (e) {
    console.error("Me Error:", e);
    res.status(500).json({ message: e.message || "Server error" });
  }
};
