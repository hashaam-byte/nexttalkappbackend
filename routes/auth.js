const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verifyToken = require('../middleware/verifyToken');

// Auth endpoints
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', verifyToken, authController.me);

module.exports = router;
// Auth endpoints
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', verifyToken, authController.me);

module.exports = router;
