/**
 * Priority calculation utility based on upvotes
 * Priority levels: Low, Medium, High, Critical/Urgent
 */

const PRIORITY_THRESHOLDS = {
  LOW: 0,      // 0-10 upvotes
  MEDIUM: 10,  // 11-22 upvotes  
  HIGH: 22,    // 23-30 upvotes
  URGENT: 30   // 30+ upvotes
};

const PRIORITY_SCORES = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4
};

/**
 * Calculate priority level based on upvotes
 * @param {number} upvotes - Number of upvotes
 * @returns {object} - Priority info with level, score, and label
 */
const calculatePriority = (upvotes = 0) => {
  let level, score, label, color;

  if (upvotes >= PRIORITY_THRESHOLDS.URGENT) {
    level = 'URGENT';
    score = PRIORITY_SCORES.URGENT;
    label = 'Critical';
    color = 'red';
  } else if (upvotes >= PRIORITY_THRESHOLDS.HIGH) {
    level = 'HIGH';
    score = PRIORITY_SCORES.HIGH;
    label = 'High';
    color = 'orange';
  } else if (upvotes >= PRIORITY_THRESHOLDS.MEDIUM) {
    level = 'MEDIUM';
    score = PRIORITY_SCORES.MEDIUM;
    label = 'Medium';
    color = 'yellow';
  } else {
    level = 'LOW';
    score = PRIORITY_SCORES.LOW;
    label = 'Low';
    color = 'green';
  }

  return {
    level,
    score,
    label,
    color,
    upvotes,
    threshold: {
      current: level,
      next: getNextThreshold(upvotes),
      nextUpvotesNeeded: getUpvotesNeededForNextLevel(upvotes)
    }
  };
};

/**
 * Get next priority threshold
 * @param {number} upvotes 
 * @returns {string|null}
 */
const getNextThreshold = (upvotes) => {
  if (upvotes < PRIORITY_THRESHOLDS.MEDIUM) return 'MEDIUM';
  if (upvotes < PRIORITY_THRESHOLDS.HIGH) return 'HIGH';
  if (upvotes < PRIORITY_THRESHOLDS.URGENT) return 'URGENT';
  return null; // Already at max priority
};

/**
 * Get upvotes needed for next priority level
 * @param {number} upvotes 
 * @returns {number}
 */
const getUpvotesNeededForNextLevel = (upvotes) => {
  if (upvotes < PRIORITY_THRESHOLDS.MEDIUM) {
    return PRIORITY_THRESHOLDS.MEDIUM - upvotes;
  } else if (upvotes < PRIORITY_THRESHOLDS.HIGH) {
    return PRIORITY_THRESHOLDS.HIGH - upvotes;
  } else if (upvotes < PRIORITY_THRESHOLDS.URGENT) {
    return PRIORITY_THRESHOLDS.URGENT - upvotes;
  }
  return 0; // Already at max priority
};

/**
 * Bulk update priorities for all reports
 * @param {mongoose.Model} Report - Report model
 * @returns {Promise<object>} - Update results
 */
const bulkUpdatePriorities = async (Report) => {
  try {
    const reports = await Report.find({}, '_id upvotes priorityScore');
    let updatedCount = 0;
    const priorityStats = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };

    const bulkOps = reports.map(report => {
      const priority = calculatePriority(report.upvotes);
      priorityStats[priority.level]++;
      
      // Only update if priority changed
      if (report.priorityScore !== priority.score) {
        updatedCount++;
        return {
          updateOne: {
            filter: { _id: report._id },
            update: { 
              priorityScore: priority.score,
              lastPriorityUpdate: new Date()
            }
          }
        };
      }
      return null;
    }).filter(op => op !== null);

    let bulkResult = { modifiedCount: 0 };
    if (bulkOps.length > 0) {
      bulkResult = await Report.bulkWrite(bulkOps);
    }

    return {
      success: true,
      totalReports: reports.length,
      updatedReports: updatedCount,
      modifiedCount: bulkResult.modifiedCount,
      priorityDistribution: priorityStats
    };
  } catch (error) {
    console.error('Error bulk updating priorities:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  calculatePriority,
  bulkUpdatePriorities,
  PRIORITY_THRESHOLDS,
  PRIORITY_SCORES,
  getNextThreshold,
  getUpvotesNeededForNextLevel
};