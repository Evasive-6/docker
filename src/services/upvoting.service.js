const Report = require('../models/Report');

/**
 * Community Upvoting and Priority System
 * Handles community engagement and priority calculation for reports
 */

class UpvotingService {
    /**
     * Add upvote to a report
     * @param {string} reportId - Report ID
     * @param {string} userId - User ID who is upvoting
     * @param {string} userLocation - User's location for proximity validation
     * @returns {Object} Upvote result
     */
    static async addUpvote(reportId, userId, userLocation = null) {
        try {
            const report = await Report.findById(reportId);
            
            if (!report) {
                return {
                    success: false,
                    message: 'Report not found'
                };
            }

            // Check if user has already upvoted (prevent duplicate voting)
            const hasUpvoted = await this.hasUserUpvoted(reportId, userId);
            if (hasUpvoted) {
                return {
                    success: false,
                    message: 'You have already upvoted this report'
                };
            }

            // Validate proximity if location provided (users should be near the issue)
            let proximityValid = true;
            if (userLocation && report.location.coordinates) {
                const distance = this.calculateDistance(
                    userLocation.coordinates[1], userLocation.coordinates[0],
                    report.location.coordinates[1], report.location.coordinates[0]
                );
                proximityValid = distance <= 5000; // Within 5km
            }

            if (!proximityValid) {
                return {
                    success: false,
                    message: 'You can only upvote reports in your vicinity'
                };
            }

            // Add upvote
            const updatedReport = await Report.findByIdAndUpdate(
                reportId,
                { 
                    $inc: { upvotes: 1 },
                    $push: {
                        upvoteHistory: {
                            userId: userId,
                            upvotedAt: new Date(),
                            userLocation: userLocation
                        }
                    }
                },
                { new: true }
            );

            // Recalculate priority based on new upvote count
            await this.updateReportPriority(reportId);

            return {
                success: true,
                message: 'Upvote added successfully',
                newUpvoteCount: updatedReport.upvotes
            };

        } catch (error) {
            console.error('Upvote error:', error);
            return {
                success: false,
                message: 'Failed to add upvote',
                error: error.message
            };
        }
    }

    /**
     * Remove upvote from a report
     * @param {string} reportId - Report ID
     * @param {string} userId - User ID who is removing upvote
     * @returns {Object} Remove upvote result
     */
    static async removeUpvote(reportId, userId) {
        try {
            const hasUpvoted = await this.hasUserUpvoted(reportId, userId);
            if (!hasUpvoted) {
                return {
                    success: false,
                    message: 'You have not upvoted this report'
                };
            }

            const updatedReport = await Report.findByIdAndUpdate(
                reportId,
                { 
                    $inc: { upvotes: -1 },
                    $pull: {
                        upvoteHistory: { userId: userId }
                    }
                },
                { new: true }
            );

            // Recalculate priority
            await this.updateReportPriority(reportId);

            return {
                success: true,
                message: 'Upvote removed successfully',
                newUpvoteCount: Math.max(0, updatedReport.upvotes)
            };

        } catch (error) {
            console.error('Remove upvote error:', error);
            return {
                success: false,
                message: 'Failed to remove upvote'
            };
        }
    }

    /**
     * Check if user has already upvoted a report
     * @param {string} reportId - Report ID
     * @param {string} userId - User ID
     * @returns {boolean} True if user has upvoted
     */
    static async hasUserUpvoted(reportId, userId) {
        try {
            const report = await Report.findOne({
                _id: reportId,
                'upvoteHistory.userId': userId
            });
            return !!report;
        } catch (error) {
            console.error('Check upvote error:', error);
            return false;
        }
    }

    /**
     * Calculate and update report priority based on multiple factors
     * @param {string} reportId - Report ID
     */
    static async updateReportPriority(reportId) {
        try {
            const report = await Report.findById(reportId);
            if (!report) return;

            const priorityScore = this.calculatePriorityScore(report);
            
            await Report.findByIdAndUpdate(reportId, {
                priorityScore: priorityScore,
                lastPriorityUpdate: new Date()
            });

        } catch (error) {
            console.error('Priority update error:', error);
        }
    }

    /**
     * Calculate priority score based on multiple factors
     * @param {Object} report - Report object
     * @returns {number} Priority score (0-100)
     */
    static calculatePriorityScore(report) {
        let score = 0;

        // Base score from upvotes (0-40 points)
        const upvoteScore = Math.min(40, (report.upvotes || 0) * 4);
        score += upvoteScore;

        // Age factor - newer reports get higher priority (0-20 points)
        const ageInHours = (Date.now() - report.createdAt) / (1000 * 60 * 60);
        const ageScore = Math.max(0, 20 - (ageInHours / 24) * 5); // Decreases over 4 days
        score += ageScore;

        // Category-based priority (0-15 points)
        const categoryPriority = this.getCategoryPriority(report.finalCategory || report.aiCategory);
        score += categoryPriority;

        // Status-based adjustment (0-10 points)
        const statusScore = this.getStatusScore(report.status);
        score += statusScore;

        // Sentiment/urgency from description (0-15 points)
        const urgencyScore = this.calculateUrgencyScore(report.description?.raw || '');
        score += urgencyScore;

        return Math.min(100, Math.round(score));
    }

    /**
     * Get priority score based on category
     * @param {string} category - Report category
     * @returns {number} Category priority score
     */
    static getCategoryPriority(category) {
        if (!category) return 5;

        const categoryPriorities = {
            'emergency': 15,
            'safety': 15,
            'health': 14,
            'security': 13,
            'water': 12,
            'electricity': 12,
            'road': 10,
            'traffic': 10,
            'waste': 8,
            'noise': 6,
            'other': 5
        };

        const categoryLower = category.toLowerCase();
        for (const [key, score] of Object.entries(categoryPriorities)) {
            if (categoryLower.includes(key)) {
                return score;
            }
        }

        return 5;
    }

    /**
     * Get score adjustment based on current status
     * @param {string} status - Report status
     * @returns {number} Status score
     */
    static getStatusScore(status) {
        const statusScores = {
            'processing': 10,
            'open': 8,
            'assigned': 5,
            'in-progress': 3,
            'flagged': 2,
            'resolved': 0,
            'deleted': 0
        };

        return statusScores[status] || 5;
    }

    /**
     * Calculate urgency score from description text
     * @param {string} description - Report description
     * @returns {number} Urgency score
     */
    static calculateUrgencyScore(description) {
        if (!description) return 0;

        const urgencyKeywords = {
            high: ['emergency', 'urgent', 'dangerous', 'blocked', 'broken', 'leak', 'flooding', 'fire'],
            medium: ['problem', 'issue', 'damaged', 'needs', 'repair', 'fix'],
            low: ['minor', 'small', 'cosmetic', 'suggestion']
        };

        const descLower = description.toLowerCase();
        let score = 0;

        // High urgency keywords
        const highCount = urgencyKeywords.high.filter(word => descLower.includes(word)).length;
        score += highCount * 3;

        // Medium urgency keywords
        const mediumCount = urgencyKeywords.medium.filter(word => descLower.includes(word)).length;
        score += mediumCount * 1.5;

        // Low urgency keywords (negative impact)
        const lowCount = urgencyKeywords.low.filter(word => descLower.includes(word)).length;
        score -= lowCount * 2;

        return Math.max(0, Math.min(15, score));
    }

    /**
     * Get trending/popular reports based on upvotes and activity
     * @param {number} limit - Number of reports to return
     * @param {Object} locationFilter - Optional location filter
     * @returns {Array} Trending reports
     */
    static async getTrendingReports(limit = 10, locationFilter = null) {
        try {
            const query = {
                // Exclude flagged, deleted, and processing reports from community view
                status: { $nin: ['resolved', 'deleted', 'flagged', 'processing'] },
                flagged: { $ne: true },
                upvotes: { $gt: 0 }
            };

            // Add location filter if provided
            if (locationFilter && locationFilter.coordinates && locationFilter.radius) {
                query.location = {
                    $near: {
                        $geometry: {
                            type: "Point",
                            coordinates: locationFilter.coordinates
                        },
                        $maxDistance: locationFilter.radius
                    }
                };
            }

            const reports = await Report.find(query)
                .sort({ 
                    priorityScore: -1, 
                    upvotes: -1, 
                    createdAt: -1 
                })
                .limit(limit)
                .populate('assignedDepartment', 'name')
                .select('description location finalCategory upvotes priorityScore status createdAt photos');

            return reports;
        } catch (error) {
            console.error('Get trending reports error:', error);
            return [];
        }
    }

    /**
     * Calculate distance between two coordinates
     * @param {number} lat1 - Latitude 1
     * @param {number} lon1 - Longitude 1
     * @param {number} lat2 - Latitude 2
     * @param {number} lon2 - Longitude 2
     * @returns {number} Distance in meters
     */
    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }
}

module.exports = UpvotingService;
