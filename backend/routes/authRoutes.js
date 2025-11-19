const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// Login route
router.post('/login', authController.login);

// Verify token route
router.get('/verify', verifyToken, authController.verifyToken);

// Logout route
router.post('/logout', verifyToken, authController.logout);

module.exports = router;
