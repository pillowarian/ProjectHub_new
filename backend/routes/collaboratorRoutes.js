const express = require('express');
const router = express.Router();
const collaboratorController = require('../controllers/collaboratorController');
const { verifyToken } = require('../middleware/auth');

// Project collaborator routes (all protected)
router.post('/project/:projectId/add', verifyToken, collaboratorController.addCollaborator);
router.delete('/project/:projectId/remove/:userId', verifyToken, collaboratorController.removeCollaborator);
router.get('/project/:projectId/collaborators', verifyToken, collaboratorController.getProjectCollaborators);
router.get('/project/:projectId/available-members', verifyToken, collaboratorController.getAvailableMembers);

module.exports = router;
