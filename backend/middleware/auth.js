const jwt = require('jsonwebtoken');

// JWT Secret - in production, this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // Token expires in 7 days

// Generate JWT token
const generateToken = (userId, username, email) => {
    return jwt.sign(
        { 
            userId, 
            username, 
            email 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
};

// Verify JWT token middleware
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                 req.headers.authorization?.replace('Bearer ', '') ||
                 req.headers['x-access-token'];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided.'
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired. Please login again.',
                expired: true
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Invalid token.'
        });
    }
};

// Optional middleware - doesn't throw error if no token
const optionalAuth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                 req.headers.authorization?.replace('Bearer ', '') ||
                 req.headers['x-access-token'];

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        req.user = null;
        next();
    }
};

module.exports = {
    generateToken,
    verifyToken,
    optionalAuth,
    JWT_SECRET
};