const bcrypt = require('bcrypt');
const db = require('../config/db');
const { generateToken } = require('../middleware/auth');

// Login user
exports.login = async (req, res) => {
    try {
        const { emailOrUsername, password } = req.body;
        
        // Validate required fields
        if (!emailOrUsername || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email/Username and password are required' 
            });
        }
        
        // Find user by email or username
        const [users] = await db.query(
            'SELECT id, username, name, email, password FROM users WHERE email = ? OR username = ?',
            [emailOrUsername, emailOrUsername]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found. Please check your credentials or create an account.' 
            });
        }
        
        const user = users[0];
        
        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password);
        
        if (!passwordMatch) {
            return res.status(401).json({ 
                success: false, 
                message: 'Incorrect password. Please try again.' 
            });
        }
        
        // Generate JWT token
        const token = generateToken(user.id, user.username, user.email);
        
        // Login successful - return user data and token
        res.json({ 
            success: true, 
            message: 'Login successful',
            data: {
                userId: user.id,
                username: user.username,
                name: user.name,
                email: user.email
            },
            token: token
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error during login',
            error: error.message 
        });
    }
};

// Verify token endpoint
exports.verifyToken = async (req, res) => {
    try {
        // Token is already verified by middleware, user data is in req.user
        const { userId, username, email } = req.user;
        
        // Get updated user info from database
        const [users] = await db.query(
            'SELECT id, username, name, email FROM users WHERE id = ?',
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        const user = users[0];
        
        res.json({
            success: true,
            message: 'Token is valid',
            data: {
                userId: user.id,
                username: user.username,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error verifying token',
            error: error.message 
        });
    }
};

// Logout endpoint (client-side token removal)
exports.logout = (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully. Please remove token from client storage.'
    });
};
