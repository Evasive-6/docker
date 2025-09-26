const Report = require('../models/Report');
const Department = require('../models/Department');
const UpvotingService = require('../services/upvoting.service');

// Track any report progress by ID
const trackReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        
        const report = await Report.findById(reportId)
            .populate('assignedDepartment', 'name')
            .populate('userId', 'phoneNumber')
            .select('-aiRawResponse -voice.transcriptRaw'); // Hide sensitive data
        
        if (!report) {
            return res.status(404).json({ 
                success: false, 
                message: 'Report not found' 
            });
        }

        res.json({ 
            success: true, 
            report: {
                id: report._id,
                status: report.status,
                finalCategory: report.finalCategory,
                description: report.description,
                location: report.location,
                assignedDepartment: report.assignedDepartment,
                publicStatusMessage: report.publicStatusMessage,
                createdAt: report.createdAt,
                resolvedAt: report.resolvedAt,
                estimatedResolutionTime: report.estimatedResolutionTime,
                photos: report.photos
            }
        });
    } catch (error) {
        console.error('Track report error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Get detailed timeline of report progress
const getReportTimeline = async (req, res) => {
    try {
        const { reportId } = req.params;
        
        const report = await Report.findById(reportId)
            .populate('statusHistory.changedBy', 'name')
            .select('statusHistory createdAt status');
        
        if (!report) {
            return res.status(404).json({ 
                success: false, 
                message: 'Report not found' 
            });
        }

        const timeline = [
            {
                status: 'submitted',
                message: 'Report submitted by citizen',
                timestamp: report.createdAt,
                isPublic: true
            },
            ...report.statusHistory.map(entry => ({
                status: entry.status,
                message: entry.customMessage || `Status changed to ${entry.status}`,
                timestamp: entry.changedAt,
                changedBy: entry.changedBy?.name || 'System',
                isPublic: true
            }))
        ];

        res.json({ 
            success: true, 
            timeline 
        });
    } catch (error) {
        console.error('Get timeline error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Get reports in specific area/pincode
const getReportsByArea = async (req, res) => {
    try {
        const { pincode } = req.params;
        const { status, category, limit = 20, page = 1 } = req.query;

        const filter = { 
            'location.zipcode': pincode,
            // Exclude flagged, deleted, and processing reports from community view
            status: { $nin: ['flagged', 'deleted', 'processing'] },
            flagged: { $ne: true }
        };
        
        if (status) filter.status = status;
        if (category) filter.finalCategory = category;

        const reports = await Report.find(filter)
            .populate('assignedDepartment', 'name')
            .select('-aiRawResponse -voice.transcriptRaw -userId')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Report.countDocuments(filter);

        res.json({ 
            success: true, 
            reports,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get reports by area error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Find reports near coordinates (geospatial)
const getNearbyReports = async (req, res) => {
    try {
        const { lat, lng, radius = 5000, limit = 20 } = req.query; // radius in meters

        if (!lat || !lng) {
            return res.status(400).json({ 
                success: false, 
                message: 'Latitude and longitude are required' 
            });
        }

        const reports = await Report.find({
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [parseFloat(lng), parseFloat(lat)]
                    },
                    $maxDistance: parseInt(radius)
                }
            },
            // Exclude flagged, deleted, and processing reports from community view
            status: { $nin: ['flagged', 'deleted', 'processing'] },
            flagged: { $ne: true }
        })
        .populate('assignedDepartment', 'name')
        .select('-aiRawResponse -voice.transcriptRaw -userId')
        .limit(parseInt(limit));

        res.json({ 
            success: true, 
            reports,
            searchCenter: { lat: parseFloat(lat), lng: parseFloat(lng) },
            radiusMeters: parseInt(radius)
        });
    } catch (error) {
        console.error('Get nearby reports error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Government performance stats, completion rates
const getPublicStatistics = async (req, res) => {
    try {
        const totalReports = await Report.countDocuments();
        const resolvedReports = await Report.countDocuments({ status: 'resolved' });
        const inProgressReports = await Report.countDocuments({ status: 'in-progress' });
        const openReports = await Report.countDocuments({ status: 'open' });

        const categoryStats = await Report.aggregate([
            { $match: { finalCategory: { $ne: '' } } },
            { $group: { _id: '$finalCategory', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const departmentStats = await Report.aggregate([
            { $match: { assignedDepartment: { $ne: null } } },
            {
                $lookup: {
                    from: 'departments',
                    localField: 'assignedDepartment',
                    foreignField: '_id',
                    as: 'department'
                }
            },
            { $unwind: '$department' },
            { $group: { _id: '$department.name', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Calculate resolution time averages
        const avgResolutionTime = await Report.aggregate([
            { $match: { status: 'resolved', resolvedAt: { $ne: null } } },
            {
                $project: {
                    resolutionTimeHours: {
                        $divide: [
                            { $subtract: ['$resolvedAt', '$createdAt'] },
                            1000 * 60 * 60
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgHours: { $avg: '$resolutionTimeHours' }
                }
            }
        ]);

        res.json({
            success: true,
            statistics: {
                overview: {
                    total: totalReports,
                    resolved: resolvedReports,
                    inProgress: inProgressReports,
                    open: openReports,
                    resolutionRate: totalReports > 0 ? ((resolvedReports / totalReports) * 100).toFixed(1) : 0
                },
                categories: categoryStats,
                departments: departmentStats,
                averageResolutionTimeHours: avgResolutionTime[0]?.avgHours?.toFixed(1) || 0,
                lastUpdated: new Date()
            }
        });
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Completed high-impact community projects
const getSuccessStories = async (req, res) => {
    try {
        const { limit = 10, page = 1 } = req.query;

        const successStories = await Report.find({ 
            status: 'resolved',
            upvotes: { $gte: 5 } // High-impact stories with upvotes
        })
        .populate('assignedDepartment', 'name')
        .populate('resolvedBy', 'name')
        .select('description location finalCategory photos resolvedAt upvotes assignedDepartment resolvedBy publicStatusMessage')
        .sort({ upvotes: -1, resolvedAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Report.countDocuments({ 
            status: 'resolved',
            upvotes: { $gte: 5 }
        });

        res.json({
            success: true,
            successStories,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get success stories error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Department performance rankings with badges
const getDepartmentLeaderboard = async (req, res) => {
    try {
        const leaderboard = await Report.aggregate([
            { $match: { assignedDepartment: { $ne: null } } },
            {
                $lookup: {
                    from: 'departments',
                    localField: 'assignedDepartment',
                    foreignField: '_id',
                    as: 'department'
                }
            },
            { $unwind: '$department' },
            {
                $group: {
                    _id: {
                        departmentId: '$department._id',
                        departmentName: '$department.name'
                    },
                    totalReports: { $sum: 1 },
                    resolvedReports: {
                        $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
                    },
                    averageUpvotes: { $avg: '$upvotes' },
                    totalUpvotes: { $sum: '$upvotes' }
                }
            },
            {
                $project: {
                    departmentName: '$_id.departmentName',
                    totalReports: 1,
                    resolvedReports: 1,
                    resolutionRate: {
                        $multiply: [
                            { $divide: ['$resolvedReports', '$totalReports'] },
                            100
                        ]
                    },
                    averageUpvotes: { $round: ['$averageUpvotes', 1] },
                    totalUpvotes: 1,
                    performanceScore: {
                        $add: [
                            { $multiply: [
                                { $divide: ['$resolvedReports', '$totalReports'] },
                                70
                            ]},
                            { $multiply: ['$averageUpvotes', 30] }
                        ]
                    }
                }
            },
            { $sort: { performanceScore: -1 } }
        ]);

        // Add badges based on performance
        const leaderboardWithBadges = leaderboard.map((dept, index) => {
            const badges = [];
            
            if (index === 0) badges.push({ name: '🏆 Top Performer', color: 'gold' });
            if (dept.resolutionRate >= 90) badges.push({ name: '⚡ Fast Resolver', color: 'blue' });
            if (dept.averageUpvotes >= 4) badges.push({ name: '❤️ Community Favorite', color: 'red' });
            if (dept.totalReports >= 100) badges.push({ name: '💪 High Volume', color: 'green' });

            return {
                ...dept,
                rank: index + 1,
                badges,
                performanceGrade: dept.performanceScore >= 80 ? 'A' : 
                               dept.performanceScore >= 60 ? 'B' : 
                               dept.performanceScore >= 40 ? 'C' : 'D'
            };
        });

        res.json({
            success: true,
            leaderboard: leaderboardWithBadges,
            lastUpdated: new Date()
        });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Add upvote to a community report (requires user authentication)
const upvoteReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        const userId = req.user._id;
        const userLocation = req.body.location; // User's current location for proximity check

        const result = await UpvotingService.addUpvote(reportId, userId, userLocation);
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

        res.json({
            success: true,
            message: result.message,
            upvotes: result.newUpvoteCount
        });
    } catch (error) {
        console.error('Upvote report error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Remove upvote from a community report
const removeUpvote = async (req, res) => {
    try {
        const { reportId } = req.params;
        const userId = req.user._id;

        const result = await UpvotingService.removeUpvote(reportId, userId);
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

        res.json({
            success: true,
            message: result.message,
            upvotes: result.newUpvoteCount
        });
    } catch (error) {
        console.error('Remove upvote error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Get trending reports based on upvotes and priority
const getTrendingReports = async (req, res) => {
    try {
        const { limit = 10, lat, lng, radius = 5000 } = req.query;

        let locationFilter = null;
        if (lat && lng) {
            locationFilter = {
                coordinates: [parseFloat(lng), parseFloat(lat)],
                radius: parseInt(radius)
            };
        }

        const trendingReports = await UpvotingService.getTrendingReports(
            parseInt(limit), 
            locationFilter
        );

        res.json({
            success: true,
            reports: trendingReports,
            metadata: {
                total: trendingReports.length,
                locationFiltered: !!locationFilter,
                searchRadius: locationFilter ? locationFilter.radius : null
            }
        });
    } catch (error) {
        console.error('Get trending reports error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Check if user has upvoted a specific report
const checkUserUpvote = async (req, res) => {
    try {
        const { reportId } = req.params;
        const userId = req.user._id;

        const hasUpvoted = await UpvotingService.hasUserUpvoted(reportId, userId);

        res.json({
            success: true,
            hasUpvoted
        });
    } catch (error) {
        console.error('Check upvote error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

module.exports = {
    trackReport,
    getReportTimeline,
    getReportsByArea,
    getNearbyReports,
    getPublicStatistics,
    getSuccessStories,
    getDepartmentLeaderboard,
    upvoteReport,
    removeUpvote,
    getTrendingReports,
    checkUserUpvote
};