const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { verifyToken, optionalAuth } = require('../middleware/auth');

// Public Routes (no auth required)
router.get('/search', optionalAuth, projectController.searchProjects);
router.get('/organizations', projectController.getOrganizations);
router.get('/tags', projectController.getTags);
router.get('/', optionalAuth, projectController.getAllProjects);
router.get('/user/:userId', optionalAuth, projectController.getUserProjects);
router.get('/:projectId', optionalAuth, projectController.getProject);
router.get('/:projectId/comments', optionalAuth, projectController.getComments);
router.get('/comments/:commentId/replies', optionalAuth, projectController.getCommentReplies);

// Protected Routes (auth required)
router.post('/', verifyToken, projectController.createProject);
router.patch('/:projectId', verifyToken, projectController.updateProject);
router.delete('/:projectId', verifyToken, projectController.deleteProject);

// Like Routes (auth required)
router.post('/:projectId/like', verifyToken, projectController.toggleLike);

// Comment Routes (auth required for posting/liking)
router.post('/:projectId/comments', verifyToken, projectController.addComment);
router.post('/comments/:commentId/like', verifyToken, projectController.toggleCommentLike);

module.exports = router;
