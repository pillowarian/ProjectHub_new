const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { verifyToken } = require('../middleware/auth');

// Message routes (all protected)
router.post('/send', verifyToken, messageController.sendMessage);
router.get('/conversation/:userId', verifyToken, messageController.getConversation);
router.get('/conversations', verifyToken, messageController.getConversations);
router.patch('/:messageId/read', verifyToken, messageController.markAsRead);
router.delete('/:messageId', verifyToken, messageController.deleteMessage);

module.exports = router;
