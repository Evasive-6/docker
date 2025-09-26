const Report = require('../models/Report');
const Department = require('../models/Department');
const Admin = require('../models/Admin');

/**
 * GET /admin/dashboard/stats
 * Return overall dashboard statistics
 */
async function getDashboardStats(req, res) {
  try {
    // Total reports by status
    const totalReportsByStatusAgg = await Report.aggregate([
      { $match: {} }, // optionally, filter by date or department later
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const totalReportsByStatus = totalReportsByStatusAgg.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    // Reports by category / department
    const reportsByCategoryAgg = await Report.aggregate([
      { $match: {} },
      { $group: { _id: "$finalCategory", count: { $sum: 1 } } }
    ]);

    const reportsByCategory = reportsByCategoryAgg.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    // Recent activity: last 10 status changes
    const recentActivity = await Report.aggregate([
      { $unwind: "$statusHistory" },
      { $sort: { "statusHistory.changedAt": -1 } },
      { $limit: 10 },
      {
        $project: {
          reportId: "$_id",
          status: "$statusHistory.status",
          changedBy: "$statusHistory.changedBy",
          changedAt: "$statusHistory.changedAt"
        }
      }
    ]);

    // Department workload stats
    const departments = await Department.find({ isActive: true }).lean();
    const departmentWorkload = await Promise.all(
      departments.map(async (dept) => {
        const totalReports = await Report.countDocuments({ assignedDepartment: dept._id });
        const resolvedReports = await Report.countDocuments({ assignedDepartment: dept._id, status: "resolved" });
        
        // Avg resolution time in hours
        const resolutionAgg = await Report.aggregate([
          { $match: { assignedDepartment: dept._id, resolvedAt: { $exists: true } } },
          { $project: { resolutionHours: { $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 1000 * 60 * 60] } } },
          { $group: { _id: null, avgResolutionHours: { $avg: "$resolutionHours" } } }
        ]);

        const averageResolutionTime = resolutionAgg[0]?.avgResolutionHours || 0;

        return {
          department: dept.name,
          totalReports,
          resolvedReports,
          averageResolutionTime: parseFloat(averageResolutionTime.toFixed(2))
        };
      })
    );

    // Response time metrics
    const responseTimeAgg = await Report.aggregate([
      { $match: { assignedAt: { $exists: true }, resolvedAt: { $exists: true } } },
      {
        $project: {
          creationToAssignmentHours: { $divide: [{ $subtract: ["$assignedAt", "$createdAt"] }, 1000 * 60 * 60] },
          assignmentToResolutionHours: { $divide: [{ $subtract: ["$resolvedAt", "$assignedAt"] }, 1000 * 60 * 60] }
        }
      },
      {
        $group: {
          _id: null,
          avgCreationToAssignmentHours: { $avg: "$creationToAssignmentHours" },
          avgAssignmentToResolutionHours: { $avg: "$assignmentToResolutionHours" }
        }
      }
    ]);

    const responseTimeMetrics = responseTimeAgg[0] || { avgCreationToAssignmentHours: 0, avgAssignmentToResolutionHours: 0 };

    res.json({
      totalReportsByStatus,
      reportsByCategory,
      recentActivity,
      departmentWorkload,
      responseTimeMetrics
    });

  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    res.status(500).json({ message: "Failed to fetch dashboard statistics" });
  }
}

module.exports = {
  getDashboardStats
};
