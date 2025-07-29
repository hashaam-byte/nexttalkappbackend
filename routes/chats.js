const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/chats/recent?user_id=...
router.get('/recent', async (req, res) => {
  const { user_id } = req.query;
  try {
    const result = await db.query(
      `SELECT c.contact_name, c.avatar, m.text as last_message, m.timestamp
       FROM chats c
       LEFT JOIN messages m ON m.chat_id = c.id
       WHERE c.user_id = $1
       ORDER BY m.timestamp DESC
       LIMIT 10`, [user_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
