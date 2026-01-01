const db = require('../config/db');

// Send a message
exports.sendMessage = async (req, res) => {
    try {
        const senderId = req.user.userId;
        const { recipientId, content } = req.body;

        // Validate inputs
        if (!recipientId || !content || content.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Recipient ID and content are required'
            });
        }

        // Prevent self-messaging
        if (senderId === parseInt(recipientId)) {
            return res.status(400).json({
                success: false,
                message: 'You cannot message yourself'
            });
        }

        // Check if both users exist and are in same organization
        const [users] = await db.query(
            'SELECT id, organization FROM users WHERE id = ? OR id = ?',
            [senderId, recipientId]
        );

        if (users.length < 2) {
            return res.status(404).json({
                success: false,
                message: 'One or both users not found'
            });
        }

        if (users[0].organization !== users[1].organization || !users[0].organization) {
            return res.status(403).json({
                success: false,
                message: 'Users must be in the same organization to message'
            });
        }

        // Insert message
        const [result] = await db.query(
            'INSERT INTO messages (sender_id, recipient_id, content) VALUES (?, ?, ?)',
            [senderId, recipientId, content.trim()]
        );

        // Create notification for recipient
        const notificationController = require('./notificationController');
        const [senderData] = await db.query('SELECT name FROM users WHERE id = ?', [senderId]);
        const senderName = senderData[0]?.name || 'User';
        
        await notificationController.createNotification(
            recipientId,
            'message',
            `${senderName} has sent a new message`,
            content.trim(),
            null,
            senderId,
            'message',
            result.insertId
        );

        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: { messageId: result.insertId }
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending message',
            error: error.message
        });
    }
};

// Get conversation between two users
exports.getConversation = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { userId: otherUserId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const [messages] = await db.query(
            `SELECT m.*, 
                    s.username as sender_username, s.name as sender_name,
                    r.username as recipient_username, r.name as recipient_name
             FROM messages m
             JOIN users s ON m.sender_id = s.id
             JOIN users r ON m.recipient_id = r.id
             WHERE (m.sender_id = ? AND m.recipient_id = ?) 
                OR (m.sender_id = ? AND m.recipient_id = ?)
             ORDER BY m.created_at DESC
             LIMIT ? OFFSET ?`,
            [userId, otherUserId, otherUserId, userId, parseInt(limit), parseInt(offset)]
        );

        // Mark messages as read
        await db.query(
            'UPDATE messages SET is_read = 1 WHERE recipient_id = ? AND sender_id = ? AND is_read = 0',
            [userId, otherUserId]
        );

        res.json({
            success: true,
            data: messages.reverse(),
            count: messages.length
        });
    } catch (error) {
        console.error('Error fetching conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching conversation',
            error: error.message
        });
    }
};

// Get all conversations for a user
exports.getConversations = async (req, res) => {
    try {
        const userId = req.user.userId;

        const [conversations] = await db.query(
            `SELECT 
                other_user_id,
                u.username, u.name, u.email, u.position,
                last_message,
                is_read,
                last_message_time,
                unread_count
             FROM (
                 SELECT 
                     CASE 
                         WHEN m.sender_id = ? THEN m.recipient_id 
                         ELSE m.sender_id 
                     END as other_user_id,
                     m.content as last_message,
                     m.is_read,
                     m.created_at as last_message_time,
                     ROW_NUMBER() OVER (PARTITION BY 
                         CASE 
                             WHEN m.sender_id = ? THEN m.recipient_id 
                             ELSE m.sender_id 
                         END 
                         ORDER BY m.created_at DESC
                     ) as rn,
                     (SELECT COUNT(*) FROM messages 
                      WHERE recipient_id = ? AND sender_id = 
                         CASE 
                             WHEN m.sender_id = ? THEN m.recipient_id 
                             ELSE m.sender_id 
                         END AND is_read = 0) as unread_count
                 FROM messages m
                 WHERE m.sender_id = ? OR m.recipient_id = ?
             ) m_ranked
             JOIN users u ON m_ranked.other_user_id = u.id
             WHERE m_ranked.rn = 1
             ORDER BY m_ranked.last_message_time DESC`,
            [userId, userId, userId, userId, userId, userId]
        );

        res.json({
            success: true,
            data: conversations,
            count: conversations.length
        });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching conversations',
            error: error.message
        });
    }
};

// Mark a message as read
exports.markAsRead = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { messageId } = req.params;

        const [result] = await db.query(
            'UPDATE messages SET is_read = 1 WHERE id = ? AND recipient_id = ?',
            [messageId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Message not found or unauthorized'
            });
        }

        res.json({
            success: true,
            message: 'Message marked as read'
        });
    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking message as read',
            error: error.message
        });
    }
};

// Delete a message
exports.deleteMessage = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { messageId } = req.params;

        const [result] = await db.query(
            'DELETE FROM messages WHERE id = ? AND sender_id = ?',
            [messageId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Message not found or unauthorized'
            });
        }

        res.json({
            success: true,
            message: 'Message deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting message',
            error: error.message
        });
    }
};
