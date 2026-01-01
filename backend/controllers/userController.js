const db = require('../config/db');

// Follow a user within organization
exports.followUser = async (req, res) => {
    try {
        const followerId = req.user.userId;
        const { userId: followingId } = req.params;

        // Prevent self-follow
        if (followerId === parseInt(followingId)) {
            return res.status(400).json({
                success: false,
                message: 'You cannot follow yourself'
            });
        }

        // Check if both users are in the same organization
        const [followers] = await db.query(
            'SELECT organization FROM users WHERE id = ? OR id = ?',
            [followerId, followingId]
        );

        if (followers.length < 2) {
            return res.status(404).json({
                success: false,
                message: 'One or both users not found'
            });
        }

        if (followers[0].organization !== followers[1].organization || !followers[0].organization) {
            return res.status(403).json({
                success: false,
                message: 'Users must be in the same organization to follow'
            });
        }

        // Insert follow relationship
        try {
            await db.query(
                'INSERT INTO user_follows (follower_id, following_id) VALUES (?, ?)',
                [followerId, followingId]
            );

            res.status(201).json({
                success: true,
                message: 'User followed successfully'
            });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    success: false,
                    message: 'You are already following this user'
                });
            }
            throw error;
        }
    } catch (error) {
        console.error('Error following user:', error);
        res.status(500).json({
            success: false,
            message: 'Error following user',
            error: error.message
        });
    }
};

// Unfollow a user
exports.unfollowUser = async (req, res) => {
    try {
        const followerId = req.user.userId;
        const { userId: followingId } = req.params;

        const [result] = await db.query(
            'DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?',
            [followerId, followingId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Follow relationship not found'
            });
        }

        res.json({
            success: true,
            message: 'User unfollowed successfully'
        });
    } catch (error) {
        console.error('Error unfollowing user:', error);
        res.status(500).json({
            success: false,
            message: 'Error unfollowing user',
            error: error.message
        });
    }
};

// Get followers of a user
exports.getFollowers = async (req, res) => {
    try {
        const { userId } = req.params;

        const [followers] = await db.query(
            `SELECT u.id, u.username, u.name, u.position, u.organization, u.email 
             FROM users u
             INNER JOIN user_follows uf ON u.id = uf.follower_id
             WHERE uf.following_id = ?
             ORDER BY uf.created_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            data: followers,
            count: followers.length
        });
    } catch (error) {
        console.error('Error fetching followers:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching followers',
            error: error.message
        });
    }
};

// Get users that a user is following
exports.getFollowing = async (req, res) => {
    try {
        const { userId } = req.params;

        const [following] = await db.query(
            `SELECT u.id, u.username, u.name, u.position, u.organization, u.email 
             FROM users u
             INNER JOIN user_follows uf ON u.id = uf.following_id
             WHERE uf.follower_id = ?
             ORDER BY uf.created_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            data: following,
            count: following.length
        });
    } catch (error) {
        console.error('Error fetching following:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching following',
            error: error.message
        });
    }
};

// Check if user is following another user
exports.isFollowing = async (req, res) => {
    try {
        const followerId = req.user.userId;
        const { userId: followingId } = req.params;

        const [result] = await db.query(
            'SELECT COUNT(*) as count FROM user_follows WHERE follower_id = ? AND following_id = ?',
            [followerId, followingId]
        );

        const isFollowing = result[0].count > 0;

        res.json({
            success: true,
            isFollowing: isFollowing
        });
    } catch (error) {
        console.error('Error checking follow status:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking follow status',
            error: error.message
        });
    }
};

// Get organization members (for follow suggestions)
exports.getOrganizationMembers = async (req, res) => {
    try {
        const { organization } = req.params;
        const currentUserId = req.user.userId;

        const [members] = await db.query(
            `SELECT u.id, u.username, u.name, u.position, u.email,
                    (SELECT COUNT(*) FROM user_follows WHERE follower_id = ? AND following_id = u.id) as is_following
             FROM users u
             WHERE u.organization = ? AND u.id != ?
             ORDER BY u.name`,
            [currentUserId, organization, currentUserId]
        );

        res.json({
            success: true,
            data: members,
            count: members.length
        });
    } catch (error) {
        console.error('Error fetching organization members:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching organization members',
            error: error.message
        });
    }
};
