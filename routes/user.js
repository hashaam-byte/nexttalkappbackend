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

// GET /api/user/chats/recent?user_id=...
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

// =========================
// WALK TO EARN ENDPOINTS
// =========================

// GET /api/user/walk/stats?user_id=...
router.get('/walk/stats', async (req, res) => {
  const { user_id } = req.query;
  try {
    // Get today's walk stats
    const stepsRes = await db.query(
      `SELECT steps, goal, calories, distance, minutes, coins
       FROM user_steps
       WHERE user_id = $1 AND date = CURRENT_DATE`,
      [user_id]
    );
    const steps = stepsRes.rows[0] || {};
    
    // Get active challenges for today
    const challengesRes = await db.query(
      `SELECT 
         c.id,
         c.title,
         c.description,
         c.target_steps as target,
         c.reward_coins as reward,
         COALESCE(uc.is_completed, false) as completed,
         LEAST(COALESCE(us.steps, 0), c.target_steps) as current
       FROM challenges c
       LEFT JOIN user_challenges uc ON c.id = uc.challenge_id 
         AND uc.user_id = $1 AND uc.assigned_at = CURRENT_DATE
       LEFT JOIN user_steps us ON us.user_id = $1 AND us.date = CURRENT_DATE
       WHERE c.level = (
         SELECT COALESCE(current_level, 'beginner') 
         FROM user_challenge_status 
         WHERE user_id = $1
       )
       ORDER BY c.target_steps`,
      [user_id]
    );

    res.json({
      steps: steps.steps || 0,
      goal: steps.goal || 10000,
      coins: steps.coins || 0,
      calories: steps.calories || 0,
      distance: steps.distance || 0.0,
      minutes: steps.minutes || 0,
      challenges: challengesRes.rows || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/user/walk/report - Report walking stats from Flutter app
router.post('/walk/report', async (req, res) => {
  const { user_id, steps, distance_km, calories, duration_minutes, pedestrian_status } = req.body;
  
  try {
    // Upsert user steps for today
    await db.query(
      `INSERT INTO user_steps (user_id, date, steps, distance, calories, minutes, updated_at)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, date)
       DO UPDATE SET 
         steps = GREATEST(user_steps.steps, $2),
         distance = GREATEST(user_steps.distance, $3),
         calories = GREATEST(user_steps.calories, $4),
         minutes = GREATEST(user_steps.minutes, $5),
         updated_at = NOW()`,
      [user_id, steps, distance_km, calories, duration_minutes]
    );

    // Calculate coins earned (1 coin per 1000 steps)
    const coinsEarned = Math.floor(steps / 1000);
    
    // Update user's total coins
    if (coinsEarned > 0) {
      await db.query(
        `UPDATE users SET coins = coins + $1 WHERE id = $2`,
        [coinsEarned, user_id]
      );
    }

    // Log activity for anti-cheat
    await db.query(
      `INSERT INTO activity_logs (user_id, activity_type, data, created_at)
       VALUES ($1, 'step_report', $2, NOW())`,
      [user_id, JSON.stringify({ 
        steps, 
        distance_km, 
        calories, 
        duration_minutes, 
        pedestrian_status 
      })]
    );

    res.json({ 
      success: true, 
      coins_earned: coinsEarned,
      total_steps: steps 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/user/walk/claim-reward - Claim challenge reward
router.post('/walk/claim-reward', async (req, res) => {
  const { user_id, challenge_id, reward_amount } = req.body;
  
  try {
    // Check if challenge is completed and not already claimed
    const challengeCheck = await db.query(
      `SELECT uc.*, c.target_steps, us.steps
       FROM user_challenges uc
       JOIN challenges c ON uc.challenge_id = c.id
       LEFT JOIN user_steps us ON us.user_id = $1 AND us.date = CURRENT_DATE
       WHERE uc.user_id = $1 AND uc.challenge_id = $2 AND uc.assigned_at = CURRENT_DATE`,
      [user_id, challenge_id]
    );

    if (!challengeCheck.rows.length) {
      return res.status(400).json({ error: 'Challenge not found or not assigned today' });
    }

    const challenge = challengeCheck.rows[0];
    
    // Check if user has reached target steps
    if ((challenge.steps || 0) < challenge.target_steps) {
      return res.status(400).json({ error: 'Challenge not completed yet' });
    }

    // Check if already claimed
    if (challenge.reward_claimed) {
      return res.status(400).json({ error: 'Reward already claimed' });
    }

    // Mark as completed and claimed
    await db.query(
      `UPDATE user_challenges 
       SET is_completed = true, reward_claimed = true, completed_at = NOW()
       WHERE user_id = $1 AND challenge_id = $2 AND assigned_at = CURRENT_DATE`,
      [user_id, challenge_id]
    );

    // Add coins to user
    await db.query(
      `UPDATE users SET coins = coins + $1 WHERE id = $2`,
      [reward_amount, user_id]
    );

    // Get updated total coins
    const userResult = await db.query(
      `SELECT coins FROM users WHERE id = $1`,
      [user_id]
    );

    res.json({
      success: true,
      reward_claimed: reward_amount,
      total_coins: userResult.rows[0]?.coins || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// CHALLENGE SYSTEM
// =========================

// Assign daily challenge (called on login or app start)
router.post('/challenge/assign', async (req, res) => {
  const { user_id } = req.body;
  const today = new Date().toISOString().split('T')[0];

  try {
    // Check if challenge already assigned today
    const existing = await db.query(
      `SELECT * FROM user_challenges WHERE user_id = $1 AND assigned_at = $2`,
      [user_id, today]
    );

    if (existing.rows.length > 0) {
      return res.json({ message: 'Challenge already assigned today.' });
    }

    // Get or create user challenge status
    const status = await db.query(
      `SELECT * FROM user_challenge_status WHERE user_id = $1`,
      [user_id]
    );

    let current_level = 'beginner';
    if (status.rows.length > 0) {
      current_level = status.rows[0].current_level;
    } else {
      await db.query(
        `INSERT INTO user_challenge_status (user_id, current_level) VALUES ($1, $2)`,
        [user_id, 'beginner']
      );
    }

    // Get random challenge for user's level
    const challenge = await db.query(
      `SELECT * FROM challenges WHERE level = $1 ORDER BY RANDOM() LIMIT 1`,
      [current_level]
    );

    if (!challenge.rows.length) {
      return res.status(404).json({ error: 'No challenge found for level' });
    }

    // Assign challenge to user
    await db.query(
      `INSERT INTO user_challenges (user_id, challenge_id, assigned_at) VALUES ($1, $2, CURRENT_DATE)`,
      [user_id, challenge.rows[0].id]
    );

    res.json({ message: 'Challenge assigned', challenge: challenge.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complete challenge and update streak
router.post('/challenge/complete', async (req, res) => {
  const { user_id } = req.body;
  const today = new Date().toISOString().split('T')[0];

  try {
    const challenge = await db.query(
      `SELECT * FROM user_challenges WHERE user_id = $1 AND assigned_at = $2`,
      [user_id, today]
    );

    if (!challenge.rows.length) {
      return res.status(404).json({ error: 'No assigned challenge for today' });
    }

    await db.query(
      `UPDATE user_challenges SET is_completed = true WHERE id = $1`,
      [challenge.rows[0].id]
    );

    const statusRes = await db.query(
      `SELECT * FROM user_challenge_status WHERE user_id = $1`,
      [user_id]
    );

    let { streak_count, total_completed, current_level } = statusRes.rows[0];

    streak_count += 1;
    total_completed += 1;

    // Level progression
    if (current_level === 'beginner' && streak_count >= 5) current_level = 'intermediate';
    if (current_level === 'intermediate' && streak_count >= 10) current_level = 'advanced';

    await db.query(
      `UPDATE user_challenge_status 
       SET streak_count = $1, total_completed = $2, current_level = $3, last_completed_at = CURRENT_DATE 
       WHERE user_id = $4`,
      [streak_count, total_completed, current_level, user_id]
    );

    res.json({ message: 'Challenge completed', new_level: current_level });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset streak if challenge missed yesterday
router.post('/challenge/reset_if_missed', async (req, res) => {
  const { user_id } = req.body;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  try {
    const challenge = await db.query(
      `SELECT * FROM user_challenges WHERE user_id = $1 AND assigned_at = $2`,
      [user_id, yesterday]
    );

    if (challenge.rows.length && !challenge.rows[0].is_completed) {
      await db.query(
        `UPDATE user_challenge_status SET streak_count = 0, current_level = 'beginner' WHERE user_id = $1`,
        [user_id]
      );
    }

    res.json({ message: 'Checked and reset if needed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user challenge + level info
router.get('/challenge/current', async (req, res) => {
  const { user_id } = req.query;
  const today = new Date().toISOString().split('T')[0];

  try {
    const challenge = await db.query(
      `SELECT c.*, uc.is_completed 
       FROM user_challenges uc 
       JOIN challenges c ON uc.challenge_id = c.id 
       WHERE uc.user_id = $1 AND uc.assigned_at = $2`,
      [user_id, today]
    );

    const status = await db.query(
      `SELECT current_level, streak_count, total_completed 
       FROM user_challenge_status 
       WHERE user_id = $1`,
      [user_id]
    );

    res.json({
      challenge: challenge.rows[0] || null,
      level_info: status.rows[0] || { current_level: 'beginner', streak_count: 0, total_completed: 0 }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;