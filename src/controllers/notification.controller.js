const AdminNotification = require('../models/AdminNotification');

// Get paginated notifications for admin
const getNotifications = async (req, res) => {
    try {
        const { page = 1, limit = 20, unreadOnly = false } = req.query;
        const adminId = req.admin._id;

        const filter = { recipient: adminId };
        if (unreadOnly === 'true') {
            filter.isRead = false;
        }

        const notifications = await AdminNotification.find(filter)
            .populate('relatedReport', 'description finalCategory')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await AdminNotification.countDocuments(filter);

        res.json({
            success: true,
            notifications,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Get count of unread notifications
const getUnreadCount = async (req, res) => {
    try {
        const adminId = req.admin._id;
        
        const count = await AdminNotification.countDocuments({
            recipient: adminId,
            isRead: false
        });

        res.json({
            success: true,
            unreadCount: count
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Get specific notification details
const getNotificationById = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.admin._id;

        const notification = await AdminNotification.findOne({
            _id: id,
            recipient: adminId
        })
        .populate('relatedReport', 'description finalCategory location status')
        .populate('relatedDepartment', 'name');

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            notification
        });
    } catch (error) {
        console.error('Get notification by ID error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Mark specific notification as read
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.admin._id;

        const notification = await AdminNotification.findOneAndUpdate(
            { _id: id, recipient: adminId },
            { 
                isRead: true,
                readAt: new Date()
            },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            notification,
            message: 'Notification marked as read'
        });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
    try {
        const adminId = req.admin._id;

        const result = await AdminNotification.updateMany(
            { recipient: adminId, isRead: false },
            { 
                isRead: true,
                readAt: new Date()
            }
        );

        res.json({
            success: true,
            message: `${result.modifiedCount} notifications marked as read`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Delete specific notification
const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.admin._id;

        const notification = await AdminNotification.findOneAndDelete({
            _id: id,
            recipient: adminId
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            message: 'Notification deleted successfully'
        });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Clear all read notifications
const clearReadNotifications = async (req, res) => {
    try {
        const adminId = req.admin._id;

        const result = await AdminNotification.deleteMany({
            recipient: adminId,
            isRead: true
        });

        res.json({
            success: true,
            message: `${result.deletedCount} read notifications cleared`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Clear read notifications error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Get notification statistics and breakdown
const getNotificationStats = async (req, res) => {
    try {
        const adminId = req.admin._id;

        const stats = await AdminNotification.aggregate([
            { $match: { recipient: adminId } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    unread: { 
                        $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
                    },
                    read: { 
                        $sum: { $cond: [{ $eq: ['$isRead', true] }, 1, 0] }
                    }
                }
            }
        ]);

        const typeBreakdown = await AdminNotification.aggregate([
            { $match: { recipient: adminId } },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    unreadCount: { 
                        $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
                    }
                }
            },
            { $sort: { count: -1 } }
        ]);

        const recentActivity = await AdminNotification.find({
            recipient: adminId
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('type message createdAt isRead');

        const summary = stats[0] || { total: 0, unread: 0, read: 0 };

        res.json({
            success: true,
            stats: {
                summary,
                typeBreakdown,
                recentActivity,
                lastUpdated: new Date()
            }
        });
    } catch (error) {
        console.error('Get notification stats error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

module.exports = {
    getNotifications,
    getUnreadCount,
    getNotificationById,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearReadNotifications,
    getNotificationStats
};