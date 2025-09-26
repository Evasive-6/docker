const express = require('express');
const router = express.Router();
const publicController = require('../controllers/public.controller');
const verifyToken = require('../middleware/auth.middleware');

// Report Tracking & Discovery
router.get('/track/:reportId', publicController.trackReport);
router.get('/track/:reportId/timeline', publicController.getReportTimeline);
router.get('/reports/area/:pincode', publicController.getReportsByArea);
router.get('/reports/nearby', publicController.getNearbyReports);

// Community Upvoting (requires authentication)
router.post('/reports/:reportId/upvote', verifyToken, publicController.upvoteReport);
router.delete('/reports/:reportId/upvote', verifyToken, publicController.removeUpvote);
router.get('/reports/:reportId/upvote/check', verifyToken, publicController.checkUserUpvote);
router.get('/reports/trending', publicController.getTrendingReports);

// Transparency & Analytics
router.get('/statistics', publicController.getPublicStatistics);
router.get('/success-stories', publicController.getSuccessStories);
router.get('/departments/leaderboard', publicController.getDepartmentLeaderboard);

module.exports = router;