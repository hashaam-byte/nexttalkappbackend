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

// GET /api/user/stats?user_id=...
router.get('/stats', async (req, res) => {
  const { user_id } = req.query;
  try {
    // Fetch user stats from DB
    const user = await db.query('SELECT display_name, coins, profile_image FROM users WHERE id = $1', [user_id]);
    const steps = await db.query('SELECT steps FROM user_steps WHERE user_id = $1 AND date = CURRENT_DATE', [user_id]);
    const streak = await db.query('SELECT streak FROM user_streaks WHERE user_id = $1', [user_id]);
    const messages = await db.query('SELECT COUNT(*) FROM messages WHERE user_id = $1 AND date = CURRENT_DATE', [user_id]);
    // Lucky box logic
    const luckyBox = true; // Your logic here

    res.json({
      display_name: user.rows[0]?.display_name || 'User',
      coins: user.rows[0]?.coins || 0,
      steps: steps.rows[0]?.steps || 0,
      streak: streak.rows[0]?.streak || 0,
      messages: messages.rows[0]?.count || 0,
      lucky_box_available: luckyBox,
      profile_image: user.rows[0]?.profile_image || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chats/recent?user_id=...
router.get('/chats/recent', async (req, res) => {
  const { user_id } = req.query;
  try {
    const result = await db.query(
      `SELECT c.contact_name, c.avatar
       FROM chats c
       WHERE c.user_id = $1
       ORDER BY c.last_message_time DESC
       LIMIT 10`,
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/walk/stats?user_id=...
router.get('/walk/stats', async (req, res) => {
  const { user_id } = req.query;
  try {
    // Steps, goal, coins, calories, distance, minutes, challenges
    const stepsRes = await db.query(
      `SELECT steps, goal, calories, distance, minutes, coins
       FROM user_steps
       WHERE user_id = $1 AND date = CURRENT_DATE`,
      [user_id]
    );
    const steps = stepsRes.rows[0] || {};
    // Challenges (dynamic, per user/day)
    const challengesRes = await db.query(
      `SELECT title, current, target, reward
       FROM user_challenges
       WHERE user_id = $1 AND date = CURRENT_DATE`,
      [user_id]
    );
    res.json({
      steps: steps.steps || 0,
      goal: steps.goal || 10000,
      coins: steps.coins || 0,
      calories: steps.calories || 0,
      distance: steps.distance || 0,
      minutes: steps.minutes || 0,
      challenges: challengesRes.rows || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
