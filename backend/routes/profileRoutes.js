const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { verifyToken, optionalAuth } = require('../middleware/auth');

// Profile Routes
router.get('/:userId', optionalAuth, profileController.getProfile); // Public view
router.post('/', profileController.createProfile); // Registration - no auth needed
router.patch('/:userId', verifyToken, profileController.updateProfile); // Protected
router.delete('/:userId', verifyToken, profileController.deleteProfile); // Protected

module.exports = router;
