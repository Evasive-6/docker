const express = require('express');
const router = express.Router();
const queueController = require('../controllers/queue.controller');
const adminAuth = require('../middleware/adminAuth.middleware');
const permissions = require('../middleware/permissions.middleware');

// All queue routes require admin authentication
router.use(adminAuth);

// Processing Queue Control
router.get('/status', permissions(['view_reports']), queueController.getQueueStatus);
router.post('/process-report', permissions(['edit_reports']), queueController.processReport);
router.post('/process-batch', permissions(['edit_reports']), queueController.processBatch);
router.post('/retry-failed', permissions(['edit_reports']), queueController.retryFailed);
router.get('/job/:jobId', permissions(['view_reports']), queueController.getJobDetails);

// Queue Maintenance
router.delete('/clear-failed', permissions(['edit_reports']), queueController.clearFailedJobs);
router.delete('/clear-completed', permissions(['edit_reports']), queueController.clearCompletedJobs);

module.exports = router;