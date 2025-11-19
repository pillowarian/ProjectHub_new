const bcrypt = require('bcrypt');
const db = require('../config/db');
const { generateToken } = require('../middleware/auth');

// Get user profile
exports.getProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const [users] = await db.query(
            'SELECT id, username, name, email, phone, position, organization, github_url, linkedin_url, total_projects, created_at, updated_at FROM users WHERE id = ?',
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        res.json({ 
            success: true, 
            data: users[0] 
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching profile',
            error: error.message 
        });
    }
};

// Create new profile
exports.createProfile = async (req, res) => {
    try {
        const { 
            username, 
            name, 
            email, 
            password, 
            phone, 
            position, 
            organization, 
            github_url, 
            linkedin_url 
        } = req.body;
        
        // Validate required fields
        if (!username || !name || !email || !password || !position) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username, name, email, password, and position are required' 
            });
        }
        
        // Validate position enum
        if (!['student', 'teacher', 'other'].includes(position)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Position must be either student, teacher, or other' 
            });
        }
        
        // Check if username or email already exists
        const [existing] = await db.query(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );
        
        if (existing.length > 0) {
            return res.status(409).json({ 
                success: false, 
                message: 'Username or email already exists' 
            });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert new user
        const [result] = await db.query(
            'INSERT INTO users (username, name, email, password, phone, position, organization, github_url, linkedin_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [username, name, email, hashedPassword, phone, position, organization, github_url, linkedin_url]
        );
        
        // Generate JWT token for the new user
        const token = generateToken(result.insertId, username, email);
        
        res.status(201).json({ 
            success: true, 
            message: 'Profile created successfully',
            data: { 
                userId: result.insertId,
                username: username,
                name: name,
                email: email
            },
            token: token
        });
    } catch (error) {
        console.error('Error creating profile:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creating profile',
            error: error.message 
        });
    }
};

// Update profile (partial update)
exports.updateProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;
        
        // Check if the user is updating their own profile
        if (req.user.userId !== parseInt(userId)) {
            return res.status(403).json({
                success: false,
                message: 'You can only update your own profile'
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
        
        // Validate position if provided
        if (updates.position && !['student', 'teacher', 'other'].includes(updates.position)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Position must be either student, teacher, or other' 
            });
        }
        
        // Fields that can be updated
        const allowedFields = [
            'username', 
            'name', 
            'email', 
            'password', 
            'phone', 
            'position', 
            'organization', 
            'github_url', 
            'linkedin_url'
        ];
        
        const updateFields = [];
        const updateValues = [];
        
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                // Check for duplicate username/email if updating
                if (field === 'username' || field === 'email') {
                    const [existing] = await db.query(
                        `SELECT id FROM users WHERE ${field} = ? AND id != ?`,
                        [updates[field], userId]
                    );
                    if (existing.length > 0) {
                        return res.status(409).json({ 
                            success: false, 
                            message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists` 
                        });
                    }
                }
                
                // Hash password if updating
                if (field === 'password') {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(await bcrypt.hash(updates[field], 10));
                } else {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(updates[field]);
                }
            }
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No valid fields to update' 
            });
        }
        
        updateValues.push(userId);
        
        await db.query(
            `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );
        
        res.json({ 
            success: true, 
            message: 'Profile updated successfully' 
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating profile',
            error: error.message 
        });
    }
};

// Delete profile and all associated projects
exports.deleteProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Check if the user is deleting their own profile
        if (req.user.userId !== parseInt(userId)) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own profile'
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
        
        // Delete user (CASCADE will delete associated projects)
        await db.query('DELETE FROM users WHERE id = ?', [userId]);
        
        res.json({ 
            success: true, 
            message: 'Profile and all associated projects deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting profile:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting profile',
            error: error.message 
        });
    }
};
