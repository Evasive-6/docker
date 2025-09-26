const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

/**
 * Middleware to verify user JWT token
 */
const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ 
                success: false, 
                message: "Authorization token missing" 
            });
        }

        const token = authHeader.split(" ")[1];
        
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ 
                success: false, 
                message: "Invalid or expired token" 
            });
        }

        // Check if it's a user token (has 'id' field) vs admin token (has 'adminId' field)
        if (!decoded.id) {
            return res.status(401).json({ 
                success: false, 
                message: "Invalid user token" 
            });
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(403).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        // Attach user info to request
        req.user = user;
        next();
        
    } catch (err) {
        console.error("User Auth Middleware Error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Server error" 
        });
    }
};

module.exports = verifyToken;
