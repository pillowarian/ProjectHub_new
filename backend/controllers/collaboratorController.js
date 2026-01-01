const db = require('../config/db');

// Add a collaborator to a project
exports.addCollaborator = async (req, res) => {
    try {
        const projectOwnerId = req.user.userId;
        const { projectId } = req.params;
        const { userId, role = 'collaborator' } = req.body;

        // Validate inputs
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        // Prevent adding self as collaborator
        if (projectOwnerId === parseInt(userId)) {
            return res.status(400).json({
                success: false,
                message: 'You cannot add yourself as a collaborator'
            });
        }

        // Verify project exists and user owns it
        const [projects] = await db.query(
            'SELECT id, organization FROM projects WHERE id = ? AND user_id = ?',
            [projectId, projectOwnerId]
        );

        if (projects.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Project not found or you do not have permission'
            });
        }

        const projectOrganization = projects[0].organization;

        // Verify collaborator exists and is in same organization
        const [users] = await db.query(
            'SELECT id, organization FROM users WHERE id = ? AND organization = ?',
            [userId, projectOrganization]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found or not in the same organization'
            });
        }

        // Insert collaborator
        try {
            await db.query(
                'INSERT INTO project_collaborators (project_id, user_id, role) VALUES (?, ?, ?)',
                [projectId, userId, role]
            );

            res.status(201).json({
                success: true,
                message: 'Collaborator added successfully'
            });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    success: false,
                    message: 'User is already a collaborator'
                });
            }
            throw error;
        }
    } catch (error) {
        console.error('Error adding collaborator:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding collaborator',
            error: error.message
        });
    }
};

// Remove a collaborator from a project
exports.removeCollaborator = async (req, res) => {
    try {
        const projectOwnerId = req.user.userId;
        const { projectId, userId } = req.params;

        // Verify project exists and user owns it
        const [projects] = await db.query(
            'SELECT id FROM projects WHERE id = ? AND user_id = ?',
            [projectId, projectOwnerId]
        );

        if (projects.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Project not found or you do not have permission'
            });
        }

        // Remove collaborator
        const [result] = await db.query(
            'DELETE FROM project_collaborators WHERE project_id = ? AND user_id = ?',
            [projectId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Collaborator not found'
            });
        }

        res.json({
            success: true,
            message: 'Collaborator removed successfully'
        });
    } catch (error) {
        console.error('Error removing collaborator:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing collaborator',
            error: error.message
        });
    }
};

// Get all collaborators for a project
exports.getProjectCollaborators = async (req, res) => {
    try {
        const { projectId } = req.params;

        const [collaborators] = await db.query(
            `SELECT pc.*, u.username, u.name, u.email, u.position 
             FROM project_collaborators pc
             JOIN users u ON pc.user_id = u.id
             WHERE pc.project_id = ?
             ORDER BY pc.created_at DESC`,
            [projectId]
        );

        res.json({
            success: true,
            data: collaborators,
            count: collaborators.length
        });
    } catch (error) {
        console.error('Error fetching collaborators:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching collaborators',
            error: error.message
        });
    }
};

// Get available members to add as collaborators
exports.getAvailableMembers = async (req, res) => {
    try {
        const { projectId } = req.params;

        // Get project's organization
        const [projects] = await db.query(
            'SELECT organization FROM projects WHERE id = ?',
            [projectId]
        );

        if (projects.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        const organization = projects[0].organization;

        // Get members in same organization not already collaborators
        const [members] = await db.query(
            `SELECT u.id, u.username, u.name, u.email, u.position
             FROM users u
             WHERE u.organization = ? 
             AND u.id NOT IN (
                 SELECT user_id FROM project_collaborators WHERE project_id = ?
             )
             AND u.id NOT IN (
                 SELECT user_id FROM projects WHERE id = ?
             )
             ORDER BY u.name`,
            [organization, projectId, projectId]
        );

        res.json({
            success: true,
            data: members,
            count: members.length
        });
    } catch (error) {
        console.error('Error fetching available members:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching available members',
            error: error.message
        });
    }
};
