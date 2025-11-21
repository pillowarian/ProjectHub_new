const db = require('../config/db');
const notificationController = require('./notificationController');

// Get all public projects
exports.getAllProjects = async (req, res) => {
    try {
        const { page = 1, limit = 10, organization, privacy = 'all', userId, tag, userOrganization } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT p.*, u.username, u.name as user_name,
                   ${userId ? `(SELECT COUNT(*) FROM project_likes pl WHERE pl.project_id = p.id AND pl.user_id = ?) as user_liked,` : ''}
                   (SELECT COUNT(*) FROM comments c WHERE c.project_id = p.id) as total_comments
            FROM projects p 
            JOIN users u ON p.user_id = u.id 
            WHERE 1=1
        `;
        const params = userId ? [userId] : [];
        
        // Privacy filter
        if (privacy === 'public') {
            query += ' AND p.privacy = ?';
            params.push('public');
        } else if (privacy === 'organization') {
            query += ' AND p.privacy IN (?, ?)';
            params.push('public', 'organization');
        } else if (privacy === 'all') {
            // Show public and organization projects
            query += ' AND p.privacy IN (?, ?)';
            params.push('public', 'organization');
        }
        
        // Organization filter
        if (organization) {
            query += ' AND p.organization = ?';
            params.push(organization);
        }
        
        // User's organization filter (for "My Organization" tab)
        if (userOrganization) {
            query += ' AND p.organization = ?';
            params.push(userOrganization);
        }
        
        // Tag filter
        if (tag) {
            query += ' AND p.tags LIKE ?';
            params.push(`%${tag}%`);
        }
        
        query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const [projects] = await db.query(query, params);
        
        res.json({ 
            success: true, 
            data: projects,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching projects',
            error: error.message 
        });
    }
};

// Search projects with fuzzy search
exports.searchProjects = async (req, res) => {
    try {
        const { q, page = 1, limit = 10, privacy = 'public', userId } = req.query;
        
        if (!q || q.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }
        
        const offset = (page - 1) * limit;
        const searchTerm = `%${q.trim()}%`;
        
        // Fuzzy search across name, tags, organization, and description
        let query = `
            SELECT p.*, u.username, u.name as user_name,
                   ${userId ? `(SELECT COUNT(*) FROM project_likes pl WHERE pl.project_id = p.id AND pl.user_id = ?) as user_liked,` : ''}
                   (SELECT COUNT(*) FROM comments c WHERE c.project_id = p.id) as total_comments,
                   CASE 
                       WHEN p.name LIKE ? THEN 5
                       WHEN p.tags LIKE ? THEN 4
                       WHEN p.organization LIKE ? THEN 3
                       WHEN p.description LIKE ? THEN 2
                       WHEN u.name LIKE ? THEN 1
                       ELSE 0
                   END as relevance_score
            FROM projects p 
            JOIN users u ON p.user_id = u.id 
            WHERE p.privacy = ?
            AND (
                p.name LIKE ? OR 
                p.tags LIKE ? OR 
                p.organization LIKE ? OR 
                p.description LIKE ? OR
                u.name LIKE ?
            )
            ORDER BY relevance_score DESC, p.created_at DESC 
            LIMIT ? OFFSET ?
        `;
        
        const params = [];
        if (userId) {
            params.push(userId);
        }
        params.push(
            searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, // For scoring
            privacy, // Privacy filter
            searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, // For WHERE clause
            parseInt(limit), parseInt(offset)
        );
        
        const [projects] = await db.query(query, params);
        
        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) as total
            FROM projects p 
            JOIN users u ON p.user_id = u.id 
            WHERE p.privacy = ?
            AND (
                p.name LIKE ? OR 
                p.tags LIKE ? OR 
                p.organization LIKE ? OR 
                p.description LIKE ? OR
                u.name LIKE ?
            )
        `;
        
        const countParams = [
            privacy,
            searchTerm, searchTerm, searchTerm, searchTerm, searchTerm
        ];
        
        const [countResult] = await db.query(countQuery, countParams);
        const total = countResult[0].total;
        
        res.json({ 
            success: true, 
            data: projects,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                totalPages: Math.ceil(total / limit)
            },
            searchQuery: q.trim()
        });
    } catch (error) {
        console.error('Error searching projects:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error searching projects',
            error: error.message 
        });
    }
};

// Get single project
exports.getProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        
        const [projects] = await db.query(
            `SELECT p.*, u.username, u.name as user_name, u.email as user_email 
             FROM projects p 
             JOIN users u ON p.user_id = u.id 
             WHERE p.id = ?`,
            [projectId]
        );
        
        if (projects.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Project not found' 
            });
        }
        
        res.json({ 
            success: true, 
            data: projects[0] 
        });
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching project',
            error: error.message 
        });
    }
};

// Get all projects by user
exports.getUserProjects = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        
        const [projects] = await db.query(
            `SELECT * FROM projects 
             WHERE user_id = ? 
             ORDER BY created_at DESC 
             LIMIT ? OFFSET ?`,
            [userId, parseInt(limit), parseInt(offset)]
        );
        
        res.json({ 
            success: true, 
            data: projects,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching user projects:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching user projects',
            error: error.message 
        });
    }
};

// Create new project
exports.createProject = async (req, res) => {
    try {
        const { 
            name, 
            description, 
            link, 
            organization, 
            tags, 
            privacy = 'public' 
        } = req.body;
        
        // Get user ID from JWT token
        const user_id = req.user.userId;
        
        // Validate required fields
        if (!name) {
            return res.status(400).json({ 
                success: false, 
                message: 'Project name is required' 
            });
        }
        
        // Insert new project
        const [result] = await db.query(
            'INSERT INTO projects (name, description, link, user_id, organization, tags, privacy) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, description, link, user_id, organization, tags, privacy]
        );
        
        // Update user's total_projects count
        await db.query(
            'UPDATE users SET total_projects = total_projects + 1 WHERE id = ?',
            [user_id]
        );
        
        // Create organization notification if project has organization and is public or organization privacy
        if (organization && (privacy === 'public' || privacy === 'organization')) {
            try {
                await notificationController.createOrganizationProjectNotification(result.insertId, user_id);
            } catch (error) {
                console.error('Error creating organization notification:', error);
            }
        }
        
        res.status(201).json({ 
            success: true, 
            message: 'Project created successfully',
            data: { projectId: result.insertId }
        });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creating project',
            error: error.message 
        });
    }
};

// Update project (partial update)
exports.updateProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const updates = req.body;
        
        // Check if project exists
        const [projects] = await db.query('SELECT id, user_id FROM projects WHERE id = ?', [projectId]);
        if (projects.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Project not found' 
            });
        }

        // Authorization: ensure the requesting user owns the project
        const requestingUserId = req.user && req.user.userId;
        if (!requestingUserId || requestingUserId != projects[0].user_id) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden. You are not the owner of this project.'
            });
        }
        
        // Validate privacy if provided
        if (updates.privacy && !['public', 'private', 'organization'].includes(updates.privacy)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Privacy must be either public, private, or organization' 
            });
        }
        
        // Fields that can be updated
        const allowedFields = [
            'name', 
            'description', 
            'link', 
            'organization', 
            'tags', 
            'privacy'
        ];
        
        const updateFields = [];
        const updateValues = [];
        
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateFields.push(`${field} = ?`);
                updateValues.push(updates[field]);
            }
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No valid fields to update' 
            });
        }
        
        updateValues.push(projectId);
        
        await db.query(
            `UPDATE projects SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );
        
        res.json({ 
            success: true, 
            message: 'Project updated successfully' 
        });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating project',
            error: error.message 
        });
    }
};

// Delete project
exports.deleteProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        
        // Check if project exists and get user_id
        const [projects] = await db.query('SELECT user_id FROM projects WHERE id = ?', [projectId]);
        if (projects.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Project not found' 
            });
        }
        const userId = projects[0].user_id;

        // Authorization: ensure the requesting user owns the project
        const requestingUserId = req.user && req.user.userId;
        if (!requestingUserId || requestingUserId != userId) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden. You are not the owner of this project.'
            });
        }
        
        // Delete project
        await db.query('DELETE FROM projects WHERE id = ?', [projectId]);
        
        // Update user's total_projects count
        await db.query(
            'UPDATE users SET total_projects = GREATEST(total_projects - 1, 0) WHERE id = ?',
            [userId]
        );
        
        res.json({ 
            success: true, 
            message: 'Project deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting project',
            error: error.message 
        });
    }
};

// Like/Unlike project
exports.toggleLike = async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.userId; // Get from JWT
        
        // Check if project exists
        const [projects] = await db.query('SELECT id FROM projects WHERE id = ?', [projectId]);
        if (projects.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Project not found' 
            });
        }
        
        // Check if already liked
        const [existingLikes] = await db.query(
            'SELECT id FROM project_likes WHERE project_id = ? AND user_id = ?',
            [projectId, userId]
        );
        
        let liked;
        if (existingLikes.length > 0) {
            // Unlike
            await db.query(
                'DELETE FROM project_likes WHERE project_id = ? AND user_id = ?',
                [projectId, userId]
            );
            await db.query(
                'UPDATE projects SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ?',
                [projectId]
            );
            liked = false;
        } else {
            // Like
            await db.query(
                'INSERT INTO project_likes (project_id, user_id) VALUES (?, ?)',
                [projectId, userId]
            );
            await db.query(
                'UPDATE projects SET likes_count = likes_count + 1 WHERE id = ?',
                [projectId]
            );
            liked = true;
            
            // Create like notification
            try {
                await notificationController.createLikeNotification(projectId, userId);
            } catch (error) {
                console.error('Error creating like notification:', error);
            }
        }
        
        // Get updated like count
        const [updatedProject] = await db.query(
            'SELECT likes_count FROM projects WHERE id = ?',
            [projectId]
        );
        
        res.json({
            success: true,
            message: liked ? 'Project liked' : 'Project unliked',
            data: {
                liked,
                likesCount: updatedProject[0].likes_count
            }
        });
    } catch (error) {
        console.error('Error toggling like:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating like status',
            error: error.message 
        });
    }
};

// Get project comments
exports.getComments = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { page = 1, limit = 20, userId } = req.query;
        const offset = (page - 1) * limit;
        
        // Check if project exists
        const [projects] = await db.query('SELECT id FROM projects WHERE id = ?', [projectId]);
        if (projects.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Project not found' 
            });
        }
        
        let query = `
            SELECT c.*, u.username, u.name as user_name,
                   ${userId ? `(SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = ?) as user_liked_comment,` : ''}
                   (SELECT COUNT(*) FROM comments replies WHERE replies.parent_comment_id = c.id) as replies_count
            FROM comments c 
            JOIN users u ON c.user_id = u.id 
            WHERE c.project_id = ? AND c.parent_comment_id IS NULL
            ORDER BY c.created_at DESC 
            LIMIT ? OFFSET ?
        `;
        
        const params = userId ? [userId, projectId, parseInt(limit), parseInt(offset)] : [projectId, parseInt(limit), parseInt(offset)];
        
        const [comments] = await db.query(query, params);
        
        res.json({
            success: true,
            data: comments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching comments',
            error: error.message 
        });
    }
};

// Add comment to project
exports.addComment = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { content, parentCommentId = null } = req.body;
        const userId = req.user.userId; // Get from JWT
        
        if (!content || content.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Content is required'
            });
        }
        
        // Check if project exists
        const [projects] = await db.query('SELECT id FROM projects WHERE id = ?', [projectId]);
        if (projects.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Project not found' 
            });
        }
        
        // If parent comment ID is provided, check if it exists
        if (parentCommentId) {
            const [parentComments] = await db.query(
                'SELECT id FROM comments WHERE id = ? AND project_id = ?',
                [parentCommentId, projectId]
            );
            if (parentComments.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Parent comment not found' 
                });
            }
        }
        
        // Insert comment
        const [result] = await db.query(
            'INSERT INTO comments (project_id, user_id, content, parent_comment_id) VALUES (?, ?, ?, ?)',
            [projectId, userId, content.trim(), parentCommentId]
        );
        
        // Update project comments count (only for top-level comments)
        if (!parentCommentId) {
            await db.query(
                'UPDATE projects SET comments_count = comments_count + 1 WHERE id = ?',
                [projectId]
            );
        }
        
        // Create comment notification
        try {
            // Get the original commenter ID if this is a reply
            let excludeUserId = null;
            if (parentCommentId) {
                const [parentComments] = await db.query('SELECT user_id FROM comments WHERE id = ?', [parentCommentId]);
                if (parentComments.length > 0) {
                    excludeUserId = parentComments[0].user_id;
                }
            }

            await notificationController.createCommentNotification(projectId, result.insertId, userId, excludeUserId);

            // If this is a reply, also notify the original commenter
            if (parentCommentId) {
                await notificationController.createReplyNotification(projectId, result.insertId, parentCommentId, userId);
            }
        } catch (error) {
            console.error('Error creating comment notification:', error);
        }
        
        // Get the created comment with user info
        const [newComment] = await db.query(`
            SELECT c.*, u.username, u.name as user_name
            FROM comments c 
            JOIN users u ON c.user_id = u.id 
            WHERE c.id = ?
        `, [result.insertId]);
        
        res.status(201).json({
            success: true,
            message: 'Comment added successfully',
            data: newComment[0]
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error adding comment',
            error: error.message 
        });
    }
};

// Toggle comment like
exports.toggleCommentLike = async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.userId; // Get from JWT
        
        // Check if comment exists
        const [comments] = await db.query('SELECT id FROM comments WHERE id = ?', [commentId]);
        if (comments.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Comment not found' 
            });
        }
        
        // Check if user exists
        const [users] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        // Check if already liked
        const [existingLikes] = await db.query(
            'SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?',
            [commentId, userId]
        );
        
        let liked;
        if (existingLikes.length > 0) {
            // Unlike
            await db.query(
                'DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?',
                [commentId, userId]
            );
            await db.query(
                'UPDATE comments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ?',
                [commentId]
            );
            liked = false;
        } else {
            // Like
            await db.query(
                'INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)',
                [commentId, userId]
            );
            await db.query(
                'UPDATE comments SET likes_count = likes_count + 1 WHERE id = ?',
                [commentId]
            );
            liked = true;
        }
        
        // Get updated like count
        const [updatedComment] = await db.query(
            'SELECT likes_count FROM comments WHERE id = ?',
            [commentId]
        );
        
        res.json({
            success: true,
            message: liked ? 'Comment liked' : 'Comment unliked',
            data: {
                liked,
                likesCount: updatedComment[0].likes_count
            }
        });
    } catch (error) {
        console.error('Error toggling comment like:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating comment like status',
            error: error.message 
        });
    }
};

// Get comment replies
exports.getCommentReplies = async (req, res) => {
    try {
        const { commentId } = req.params;
        const { page = 1, limit = 10, userId } = req.query;
        const offset = (page - 1) * limit;
        
        // Check if comment exists
        const [comments] = await db.query('SELECT id FROM comments WHERE id = ?', [commentId]);
        if (comments.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Comment not found' 
            });
        }
        
        let query = `
            SELECT c.*, u.username, u.name as user_name
                   ${userId ? `, (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = ?) as user_liked_comment` : ''}
            FROM comments c 
            JOIN users u ON c.user_id = u.id 
            WHERE c.parent_comment_id = ?
            ORDER BY c.created_at ASC 
            LIMIT ? OFFSET ?
        `;
        
        const params = userId ? [userId, commentId, parseInt(limit), parseInt(offset)] : [commentId, parseInt(limit), parseInt(offset)];
        
        const [replies] = await db.query(query, params);
        
        res.json({
            success: true,
            data: replies,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching comment replies:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching comment replies',
            error: error.message 
        });
    }
};

// Get all organizations for filter dropdown
exports.getOrganizations = async (req, res) => {
    try {
        const [organizations] = await db.query(`
            SELECT DISTINCT p.organization 
            FROM projects p 
            WHERE p.organization IS NOT NULL 
            AND p.organization != '' 
            AND p.privacy IN ('public', 'organization')
            ORDER BY p.organization ASC
        `);
        
        res.json({
            success: true,
            data: organizations.map(org => org.organization)
        });
    } catch (error) {
        console.error('Error fetching organizations:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching organizations',
            error: error.message
        });
    }
};

// Get all tags for filter dropdown
exports.getTags = async (req, res) => {
    try {
        const [projects] = await db.query(`
            SELECT DISTINCT p.tags 
            FROM projects p 
            WHERE p.tags IS NOT NULL 
            AND p.tags != '' 
            AND p.privacy IN ('public', 'organization')
        `);
        
        // Extract individual tags from comma-separated strings
        const tagSet = new Set();
        projects.forEach(project => {
            if (project.tags) {
                const tags = project.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
                tags.forEach(tag => tagSet.add(tag));
            }
        });
        
        // Convert set to array and sort
        const uniqueTags = Array.from(tagSet).sort();
        
        res.json({
            success: true,
            data: uniqueTags
        });
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching tags',
            error: error.message
        });
    }
};
