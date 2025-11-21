const db = require('../config/db');

// Get user's notifications
exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { page = 1, limit = 20, unread_only = false } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT n.*, 
                   u.username as actor_username, 
                   u.name as actor_name,
                   p.name as project_name
            FROM notifications n
            JOIN users u ON n.actor_user_id = u.id
            LEFT JOIN projects p ON n.project_id = p.id
            WHERE n.user_id = ?
        `;
        const params = [userId];
        
        if (unread_only === 'true') {
            query += ' AND n.is_read = FALSE';
        }
        
        query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const [notifications] = await db.query(query, params);
        
        // Get unread count
        const [unreadResult] = await db.query(
            'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );
        
        res.json({
            success: true,
            data: notifications,
            unread_count: unreadResult[0].unread_count,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching notifications',
            error: error.message
        });
    }
};

// Mark notification(s) as read
exports.markAsRead = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { notification_ids } = req.body; // Array of notification IDs or 'all'
        
        if (notification_ids === 'all') {
            // Mark all notifications as read
            await db.query(
                'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
                [userId]
            );
        } else if (Array.isArray(notification_ids)) {
            // Mark specific notifications as read
            if (notification_ids.length > 0) {
                const placeholders = notification_ids.map(() => '?').join(',');
                await db.query(
                    `UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND id IN (${placeholders})`,
                    [userId, ...notification_ids]
                );
            }
        } else {
            return res.status(400).json({
                success: false,
                message: 'notification_ids must be an array or "all"'
            });
        }
        
        res.json({
            success: true,
            message: 'Notifications marked as read'
        });
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking notifications as read',
            error: error.message
        });
    }
};

// Create notification (internal function)
exports.createNotification = async (recipientId, type, title, message, projectId, senderId, entityType = 'project', entityId = null) => {
    try {
        // Don't create notification if sender is the same as the recipient
        if (recipientId === senderId) {
            return;
        }

        // Determine comment_id based on entityType
        const commentId = entityType === 'comment' ? entityId : null;

        await db.query(
            `INSERT INTO notifications (user_id, actor_user_id, type, is_read, comment_id, project_id, title, message)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [recipientId, senderId, type, false, commentId, projectId, title, message]
        );
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};

// Create project like notification
exports.createLikeNotification = async (projectId, actorUserId) => {
    try {
        // Get project details and owner
        const [projects] = await db.query(
            'SELECT p.name, p.user_id, u.name as owner_name FROM projects p JOIN users u ON p.user_id = u.id WHERE p.id = ?',
            [projectId]
        );
        
        if (projects.length === 0) return;
        
        const project = projects[0];
        
        // Get actor details
        const [actors] = await db.query('SELECT name FROM users WHERE id = ?', [actorUserId]);
        if (actors.length === 0) return;
        
        const actorName = actors[0].name;
        
        await exports.createNotification(
            project.user_id,
            'like',
            'New like on your project',
            `${actorName} liked your project "${project.name}"`,
            projectId,
            actorUserId,
            'project',
            projectId
        );
    } catch (error) {
        console.error('Error creating like notification:', error);
    }
};

// Create project comment notification
exports.createCommentNotification = async (projectId, commentId, actorUserId, excludeUserId = null) => {
    try {
        // Get project details and owner
        const [projects] = await db.query(
            'SELECT p.name, p.user_id, u.name as owner_name FROM projects p JOIN users u ON p.user_id = u.id WHERE p.id = ?',
            [projectId]
        );

        if (projects.length === 0) return;

        const project = projects[0];

        // Get actor details
        const [actors] = await db.query('SELECT name FROM users WHERE id = ?', [actorUserId]);
        if (actors.length === 0) return;

        const actorName = actors[0].name;

        // Notify project owner
        if (project.user_id !== actorUserId) {
            await exports.createNotification(
                project.user_id,
                'comment',
                'New comment on your project',
                `${actorName} commented on your project "${project.name}"`,
                projectId,
                actorUserId,
                'comment',
                commentId
            );
        }

        // Get all users who have commented on this project (excluding the actor, project owner, and excluded user)
        let query = 'SELECT DISTINCT c.user_id FROM comments c WHERE c.project_id = ? AND c.user_id != ?';
        const params = [projectId, actorUserId];

        if (excludeUserId) {
            query += ' AND c.user_id != ?';
            params.push(excludeUserId);
        }

        const [commenters] = await db.query(query, params);

        // Notify all previous commenters
        for (const commenter of commenters) {
            if (commenter.user_id !== project.user_id) { // Don't notify project owner twice
                await exports.createNotification(
                    commenter.user_id,
                    'comment',
                    'New comment on a project you commented on',
                    `${actorName} also commented on "${project.name}"`,
                    projectId,
                    actorUserId,
                    'comment',
                    commentId
                );
            }
        }
    } catch (error) {
        console.error('Error creating comment notification:', error);
    }
};

// Create reply notification for original commenter
exports.createReplyNotification = async (projectId, commentId, parentCommentId, actorUserId) => {
    try {
        // Get the original commenter's user ID
        const [parentComments] = await db.query(
            'SELECT c.user_id, u.name as commenter_name FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?',
            [parentCommentId]
        );

        if (parentComments.length === 0) return;

        const originalCommenter = parentComments[0];

        // Don't notify if replying to own comment
        if (originalCommenter.user_id === actorUserId) return;

        // Get project details
        const [projects] = await db.query('SELECT p.name FROM projects p WHERE p.id = ?', [projectId]);
        if (projects.length === 0) return;

        const project = projects[0];

        // Get actor details
        const [actors] = await db.query('SELECT name FROM users WHERE id = ?', [actorUserId]);
        if (actors.length === 0) return;

        const actorName = actors[0].name;

        await exports.createNotification(
            originalCommenter.user_id,
            'comment',
            'New reply to your comment',
            `${actorName} replied to your comment on "${project.name}"`,
            projectId,
            actorUserId,
            'comment',
            commentId
        );
    } catch (error) {
        console.error('Error creating reply notification:', error);
    }
};

// Create organization project notification
exports.createOrganizationProjectNotification = async (projectId, actorUserId) => {
    try {
        // Get project details
        const [projects] = await db.query(
            'SELECT p.name, p.organization, u.name as creator_name FROM projects p JOIN users u ON p.user_id = u.id WHERE p.id = ?',
            [projectId]
        );
        
        if (projects.length === 0 || !projects[0].organization) return;
        
        const project = projects[0];
        
        // Get all users in the same organization (excluding the creator)
        const [orgUsers] = await db.query(
            'SELECT id FROM users WHERE organization = ? AND id != ?',
            [project.organization, actorUserId]
        );
        
        // Create notifications for all organization members
        for (const user of orgUsers) {
            await exports.createNotification(
                user.id,
                'organization_project',
                'New project in your organization',
                `${project.creator_name} created a new project "${project.name}" in ${project.organization}`,
                projectId,
                actorUserId,
                'project',
                projectId
            );
        }
    } catch (error) {
        console.error('Error creating organization project notification:', error);
    }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { notificationId } = req.params;
        
        // Verify notification belongs to user
        const [notifications] = await db.query(
            'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
            [notificationId, userId]
        );
        
        if (notifications.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }
        
        await db.query('DELETE FROM notifications WHERE id = ?', [notificationId]);
        
        res.json({
            success: true,
            message: 'Notification deleted'
        });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting notification',
            error: error.message
        });
    }
};

// Get unread notifications count
exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.userId;

        const [result] = await db.query(
            'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );

        res.json({
            success: true,
            unread_count: result[0].unread_count
        });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting unread count',
            error: error.message
        });
    }
};