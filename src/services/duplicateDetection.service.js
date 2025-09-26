const Report = require('../models/Report');
const LocationIntegrityService = require('./locationIntegrity.service');

/**
 * Duplicate Report Detection Service
 * Identifies potential duplicate reports based on location, category, and description similarity
 */

class DuplicateDetectionService {
    /**
     * Check for duplicate reports based on multiple criteria
     * @param {Object} newReportData - New report data to check
     * @returns {Object} Duplicate detection result
     */
    static async checkForDuplicates(newReportData) {
        try {
            const duplicateResult = {
                isDuplicate: false,
                duplicateReports: [],
                confidence: 0,
                reasons: []
            };

            // Get reports within proximity (same location area)
            const nearbyReports = await this.findNearbyReports(
                newReportData.location.coordinates,
                50 // 50 meters radius
            );

            if (nearbyReports.length === 0) {
                return duplicateResult;
            }

            // Check each nearby report for similarity
            for (const existingReport of nearbyReports) {
                const similarity = await this.calculateSimilarity(newReportData, existingReport);
                
                if (similarity.isDuplicate) {
                    duplicateResult.duplicateReports.push({
                        reportId: existingReport._id,
                        similarity: similarity,
                        existingReport: {
                            id: existingReport._id,
                            description: existingReport.description.raw,
                            finalCategory: existingReport.finalCategory,
                            aiCategory: existingReport.aiCategory,
                            createdAt: existingReport.createdAt,
                            status: existingReport.status
                        }
                    });
                }
            }

            if (duplicateResult.duplicateReports.length > 0) {
                duplicateResult.isDuplicate = true;
                duplicateResult.confidence = Math.max(
                    ...duplicateResult.duplicateReports.map(d => d.similarity.totalScore)
                );
                duplicateResult.reasons = this.generateDuplicateReasons(duplicateResult.duplicateReports);
            }

            return duplicateResult;
        } catch (error) {
            console.error('Duplicate detection error:', error);
            return {
                isDuplicate: false,
                duplicateReports: [],
                confidence: 0,
                reasons: [],
                error: error.message
            };
        }
    }

    /**
     * Find reports within a specific radius of given coordinates
     * @param {Array} coordinates - [longitude, latitude]
     * @param {number} radiusMeters - Radius in meters
     * @returns {Array} Nearby reports
     */
    static async findNearbyReports(coordinates, radiusMeters = 50) {
        try {
            const reports = await Report.find({
                location: {
                    $near: {
                        $geometry: {
                            type: "Point",
                            coordinates: coordinates
                        },
                        $maxDistance: radiusMeters
                    }
                },
                status: { $nin: ['resolved', 'deleted'] }, // Only check active reports
                createdAt: {
                    $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                }
            }).select('description finalCategory aiCategory location createdAt status upvotes');

            return reports;
        } catch (error) {
            console.error('Error finding nearby reports:', error);
            return [];
        }
    }

    /**
     * Calculate similarity between two reports
     * @param {Object} newReport - New report data
     * @param {Object} existingReport - Existing report from database
     * @returns {Object} Similarity analysis
     */
    static async calculateSimilarity(newReport, existingReport) {
        const similarity = {
            isDuplicate: false,
            locationScore: 0,
            categoryScore: 0,
            descriptionScore: 0,
            totalScore: 0,
            factors: []
        };

        // 1. Location similarity (exact same location = high score)
        const locationDistance = LocationIntegrityService.calculateDistance(
            newReport.location.coordinates[1], // lat
            newReport.location.coordinates[0], // lng
            existingReport.location.coordinates[1],
            existingReport.location.coordinates[0]
        );

        if (locationDistance <= 10) { // Within 10 meters
            similarity.locationScore = 100;
            similarity.factors.push('Same exact location');
        } else if (locationDistance <= 25) {
            similarity.locationScore = 80;
            similarity.factors.push('Very close location');
        } else if (locationDistance <= 50) {
            similarity.locationScore = 60;
            similarity.factors.push('Nearby location');
        }

        // 2. Category similarity
        const newCategory = newReport.finalCategory || newReport.userCategory || '';
        const existingFinalCategory = existingReport.finalCategory || '';
        const existingAiCategory = existingReport.aiCategory || '';

        if (newCategory && (
            newCategory.toLowerCase() === existingFinalCategory.toLowerCase() ||
            newCategory.toLowerCase() === existingAiCategory.toLowerCase()
        )) {
            similarity.categoryScore = 100;
            similarity.factors.push('Same category');
        } else if (this.categoriesRelated(newCategory, existingFinalCategory) ||
                   this.categoriesRelated(newCategory, existingAiCategory)) {
            similarity.categoryScore = 75;
            similarity.factors.push('Related category');
        }

        // 3. Description similarity
        const newDesc = (newReport.description?.raw || newReport.description || '').toLowerCase();
        const existingDesc = (existingReport.description?.raw || '').toLowerCase();

        if (newDesc && existingDesc) {
            similarity.descriptionScore = this.calculateTextSimilarity(newDesc, existingDesc);
            
            if (similarity.descriptionScore > 80) {
                similarity.factors.push('Very similar description');
            } else if (similarity.descriptionScore > 60) {
                similarity.factors.push('Similar description');
            }
        }

        // Calculate total score (weighted average)
        similarity.totalScore = (
            similarity.locationScore * 0.4 +    // Location is most important
            similarity.categoryScore * 0.3 +     // Category is important
            similarity.descriptionScore * 0.3    // Description provides context
        );

        // Determine if it's a duplicate (threshold: 75%)
        similarity.isDuplicate = similarity.totalScore >= 75 && 
                                similarity.locationScore >= 60 && 
                                similarity.categoryScore >= 75;

        return similarity;
    }

    /**
     * Check if two categories are related
     * @param {string} cat1 - Category 1
     * @param {string} cat2 - Category 2
     * @returns {boolean} True if categories are related
     */
    static categoriesRelated(cat1, cat2) {
        if (!cat1 || !cat2) return false;

        const relatedCategories = {
            'road': ['infrastructure', 'transport', 'street', 'highway'],
            'water': ['drainage', 'sewage', 'plumbing', 'leak'],
            'electricity': ['power', 'lighting', 'streetlight', 'electrical'],
            'waste': ['garbage', 'trash', 'sanitation', 'cleaning'],
            'public': ['safety', 'security', 'civic', 'municipal']
        };

        const cat1Lower = cat1.toLowerCase();
        const cat2Lower = cat2.toLowerCase();

        for (const [mainCat, related] of Object.entries(relatedCategories)) {
            if ((cat1Lower.includes(mainCat) && related.some(r => cat2Lower.includes(r))) ||
                (cat2Lower.includes(mainCat) && related.some(r => cat1Lower.includes(r)))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Calculate text similarity using simple word overlap
     * @param {string} text1 - First text
     * @param {string} text2 - Second text
     * @returns {number} Similarity score (0-100)
     */
    static calculateTextSimilarity(text1, text2) {
        if (!text1 || !text2) return 0;

        // Simple word-based similarity
        const words1 = text1.toLowerCase().split(/\W+/).filter(w => w.length > 3);
        const words2 = text2.toLowerCase().split(/\W+/).filter(w => w.length > 3);

        if (words1.length === 0 || words2.length === 0) return 0;

        const commonWords = words1.filter(w => words2.includes(w));
        const similarity = (commonWords.length * 2) / (words1.length + words2.length) * 100;

        return Math.round(similarity);
    }

    /**
     * Generate human-readable reasons for duplicate detection
     * @param {Array} duplicateReports - Array of duplicate report matches
     * @returns {Array} Array of reason strings
     */
    static generateDuplicateReasons(duplicateReports) {
        const reasons = [];
        const topMatch = duplicateReports.reduce((max, current) => 
            current.similarity.totalScore > max.similarity.totalScore ? current : max
        );

        if (topMatch.similarity.locationScore >= 80) {
            reasons.push(`Same location as report #${topMatch.reportId.toString().slice(-6)}`);
        }

        if (topMatch.similarity.categoryScore >= 80) {
            reasons.push('Same issue category');
        }

        if (topMatch.similarity.descriptionScore >= 70) {
            reasons.push('Very similar description');
        }

        return reasons;
    }

    /**
     * Mark report as potential duplicate
     * @param {string} reportId - Report ID to mark as duplicate
     * @param {Object} duplicateInfo - Duplicate detection information
     */
    static async markAsPotentialDuplicate(reportId, duplicateInfo) {
        try {
            await Report.findByIdAndUpdate(reportId, {
                flagged: true,
                needsManualReview: true,
                customStatusMessage: `Potential duplicate - ${duplicateInfo.reasons.join(', ')}`,
                duplicateDetection: {
                    isDuplicate: duplicateInfo.isDuplicate,
                    confidence: duplicateInfo.confidence,
                    relatedReports: duplicateInfo.duplicateReports.map(d => d.reportId),
                    reasons: duplicateInfo.reasons,
                    detectedAt: new Date()
                }
            });
        } catch (error) {
            console.error('Error marking report as duplicate:', error);
        }
    }
}

module.exports = DuplicateDetectionService;
