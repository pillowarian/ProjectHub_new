const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../middleware/auth');

// User follow/unfollow routes
router.post('/:userId/follow', verifyToken, userController.followUser);
router.post('/:userId/unfollow', verifyToken, userController.unfollowUser);
router.get('/:userId/followers', userController.getFollowers);
router.get('/:userId/following', userController.getFollowing);
router.get('/:userId/is-following', verifyToken, userController.isFollowing);

// Get users in same organization
router.get('/organization/:organization/members', verifyToken, userController.getOrganizationMembers);

module.exports = router;
