const express = require('express');
const router = express.Router();
const utilityController = require('../controllers/utility.controller');
const verifyToken = require('../middleware/auth.middleware');

// Utility routes require authentication
router.get('/presigned-url', verifyToken, utilityController.generatePresignedUrl);

module.exports = router;