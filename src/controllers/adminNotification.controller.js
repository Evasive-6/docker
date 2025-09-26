const Notification = require('../models/AdminNotification');
const mongoose = require('mongoose');

/**
 * Get notifications for logged-in admin
 * Supports pagination, filtering by read/unread
 */
exports.getNotifications = async (req, res) => {
    try {
        const adminId = req.admin._id; // from adminAuth middleware
        const { page = 1, limit = 20, isRead } = req.query;

        const filter = { adminId };
        if (isRead !== undefined) filter.isRead = isRead === 'true';

        const notifications = await Notification.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Notification.countDocuments(filter);

        res.json({
            success: true,
            notifications,
            page: Number(page),
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Mark a notification as read
 */
exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.admin._id;

        const notification = await Notification.findOneAndUpdate(
            { _id: id, adminId },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.json({ success: true, notification });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Optional: Bulk mark all notifications as read
 */
exports.markAllAsRead = async (req, res) => {
    try {
        const adminId = req.admin._id;

        await Notification.updateMany({ adminId, isRead: false }, { isRead: true });

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Utility function to create a notification
 * Can be used in report controller triggers
 */
exports.createNotification = async ({ adminId, type, title, message, reportId = null, priority = 'medium' }) => {
    try {
        const notification = new Notification({
            adminId,
            type,
            title,
            message,
            reportId,
            priority
        });
        await notification.save();
        return notification;
    } catch (err) {
        console.error('Notification creation error:', err);
    }
};