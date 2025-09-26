const jwt=require('jsonwebtoken')
const Admin = require('../models/Admin')
require('dotenv').config()

const adminAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Authorization token missing" });
        }

        const token = authHeader.split(" ")[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ message: "Invalid or expired token" });
        }

        const admin = await Admin.findById(decoded.id); // Fixed: was decoded.adminId
        if (!admin || !admin.isActive) {
            return res.status(403).json({ message: "Admin not found or inactive" });
        }

        // Attach admin info to request
        req.admin = admin;
        next();
    } catch (err) {
        console.error("Admin Auth Middleware Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = adminAuth;