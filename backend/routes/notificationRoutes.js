const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken } = require('../middleware/auth');

// All notification routes require authentication
router.use(verifyToken);

// Get user's notifications
router.get('/', notificationController.getNotifications);

// Get unread notifications count
router.get('/count', notificationController.getUnreadCount);

// Mark notifications as read
router.patch('/read', notificationController.markAsRead);

// Delete a notification
router.delete('/:notificationId', notificationController.deleteNotification);

module.exports = router;