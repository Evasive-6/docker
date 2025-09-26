const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const adminAuth = require('../middleware/adminAuth.middleware');

// All notification routes require admin authentication
router.use(adminAuth);

// Notification Management
router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.get('/:id', notificationController.getNotificationById);
router.patch('/:id/read', notificationController.markAsRead);
router.patch('/mark-all-read', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);
router.delete('/clear-read', notificationController.clearReadNotifications);

// Notification Analytics
router.get('/stats/summary', notificationController.getNotificationStats);

module.exports = router;