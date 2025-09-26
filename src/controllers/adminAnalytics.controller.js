const Report = require("../models/Report");
const Department = require("../models/Department");
const Member = require("../models/DepartmentMember");
const { Parser } = require("json2csv"); // for CSV export
const { calculatePriority, bulkUpdatePriorities } = require("../utils/priority.util");

/**
 * GET /admin/analytics/performance
 * Department performance metrics
 */
const getDepartmentPerformance = async (req, res) => {
  try {
    // Get all departments
    const departments = await Department.find({ isActive: true });

    const performance = await Promise.all(departments.map(async (dept) => {
      // Reports for this department
      const reports = await Report.find({ assignedDepartment: dept._id });

      const resolvedReports = reports.filter(r => r.status === "resolved").length;
      const unresolvedReports = reports.length - resolvedReports;

      const avgResolutionTime = reports.length
        ? reports
            .filter(r => r.resolvedAt)
            .reduce((sum, r) => sum + (r.resolvedAt - r.createdAt), 0) / reports.length
        : 0;

      // Member workload
      const members = await Member.find({ departmentId: dept._id });
      const memberWorkload = members.map(m => ({
        memberId: m._id,
        name: m.name,
        assignedReports: m.assignedReports,
        completedReports: m.completedReports
      }));

      return {
        departmentId: dept._id,
        departmentName: dept.name,
        totalReports: reports.length,
        resolvedReports,
        unresolvedReports,
        avgResolutionTime,
        memberWorkload
      };
    }));

    res.json({ success: true, performance });
  } catch (err) {
    console.error("Analytics Performance Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /admin/analytics/trends
 * Category & location trends
 */
const getCategoryLocationTrends = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Category trends
    const categoryTrends = await Report.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$finalCategory",
          totalReports: { $sum: 1 }
        }
      },
      { $sort: { totalReports: -1 } }
    ]);

    // Location trends by district
    const locationTrends = await Report.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$location.district",
          totalReports: { $sum: 1 }
        }
      },
      { $sort: { totalReports: -1 } }
    ]);

    res.json({ success: true, categoryTrends, locationTrends });
  } catch (err) {
    console.error("Analytics Trends Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /admin/reports/export
 * Export reports to CSV
 */
const exportReports = async (req, res) => {
  try {
    const { status, category, departmentId, startDate, endDate } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.finalCategory = category;
    if (departmentId) filter.assignedDepartment = departmentId;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const reports = await Report.find(filter)
      .populate("userId", "name phone email")
      .populate("assignedDepartment", "name category")
      .populate("assignedMembers.memberId", "name email")
      .populate("resolvedBy", "name email")
      .lean();

    if (!reports.length) return res.status(404).json({ success: false, message: "No reports found" });

    const fields = [
      "createdAt",
      "userId.name",
      "userId.email",
      "description.raw",
      "finalCategory",
      "status",
      "assignedDepartment.name",
      "assignedMembers.memberId.name",
      "resolvedAt",
      "resolvedBy.name"
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(reports);

    res.header("Content-Type", "text/csv");
    res.attachment(`reports_export_${Date.now()}.csv`);
    return res.send(csv);
  } catch (err) {
    console.error("Export Reports Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /admin/analytics/timeseries
 * Time-based analytics for charts (monthly/weekly data)
 */
const getTimeSeriesAnalytics = async (req, res) => {
  try {
    const { period = 'monthly' } = req.query; // 'monthly' or 'weekly'
    
    // Calculate date range for last 6 months/weeks
    const endDate = new Date();
    const startDate = new Date();
    
    if (period === 'monthly') {
      startDate.setMonth(startDate.getMonth() - 6);
    } else {
      startDate.setDate(startDate.getDate() - 42); // 6 weeks
    }

    // Aggregate reports by time period
    const groupBy = period === 'monthly' ? 
      { 
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" }
      } : 
      { 
        year: { $year: "$createdAt" },
        week: { $week: "$createdAt" }
      };

    const timeSeries = await Report.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: groupBy,
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] }
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ["$status", "in-progress"] }, 1, 0] }
          },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
          },
          avgPriorityScore: { $avg: "$priorityScore" }
        }
      },
      { $sort: { "_id.year": 1, [`_id.${period === 'monthly' ? 'month' : 'week'}`]: 1 } }
    ]);

    // Format the data for frontend consumption
    const formattedData = timeSeries.map(item => {
      const efficiency = item.total > 0 ? (item.completed / item.total) * 100 : 0;
      
      let label;
      if (period === 'monthly') {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label = monthNames[item._id.month - 1];
      } else {
        label = `W${item._id.week}`;
      }

      return {
        period: label,
        total: item.total,
        completed: item.completed,
        inProgress: item.inProgress,
        pending: item.pending,
        efficiency: Math.round(efficiency * 10) / 10,
        avgPriorityScore: Math.round(item.avgPriorityScore || 0)
      };
    });

    res.json({ success: true, data: formattedData, period });
  } catch (err) {
    console.error("Time Series Analytics Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /admin/analytics/category-breakdown
 * Detailed category breakdown with real statistics
 */
const getCategoryBreakdown = async (req, res) => {
  try {
    const { period = '30' } = req.query; // Default to last 30 days
    
    // Calculate date range
    const daysAgo = parseInt(period) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // Get all reports in the period
    const reports = await Report.find({
      createdAt: { $gte: startDate }
    });

    // Get reports from the previous period for comparison
    const prevStartDate = new Date();
    prevStartDate.setDate(prevStartDate.getDate() - (daysAgo * 2));
    const prevEndDate = new Date();
    prevEndDate.setDate(prevEndDate.getDate() - daysAgo);

    const prevReports = await Report.find({
      createdAt: { $gte: prevStartDate, $lt: prevEndDate }
    });

    // Define category mappings with icons and priorities
    const categoryConfig = {
      "Road & Infrastructure": {
        icon: "🛣️",
        priority: "High",
        color: "blue"
      },
      "Water & Sewerage": {
        icon: "💧",
        priority: "Critical",
        color: "cyan"
      },
      "Waste Management": {
        icon: "♻️",
        priority: "High",
        color: "red"
      },
      "Street Lighting & Electrical": {
        icon: "💡",
        priority: "Medium",
        color: "yellow"
      },
      "Public Safety & Order": {
        icon: "🛡️",
        priority: "High",
        color: "purple"
      },
      "Other": {
        icon: "📋",
        priority: "Medium",
        color: "gray"
      }
    };

    // Aggregate current period data
    const currentStats = {};
    const prevStats = {};

    // Process current reports
    reports.forEach(report => {
      const category = report.finalCategory || report.aiCategory || "Other";
      if (!currentStats[category]) {
        currentStats[category] = 0;
      }
      currentStats[category]++;
    });

    // Process previous reports
    prevReports.forEach(report => {
      const category = report.finalCategory || report.aiCategory || "Other";
      if (!prevStats[category]) {
        prevStats[category] = 0;
      }
      prevStats[category]++;
    });

    // Calculate total reports
    const totalReports = Object.values(currentStats).reduce((sum, count) => sum + count, 0);
    const totalPrevReports = Object.values(prevStats).reduce((sum, count) => sum + count, 0);

    // Build category breakdown
    const categoryBreakdown = Object.keys(categoryConfig).map(categoryName => {
      const count = currentStats[categoryName] || 0;
      const prevCount = prevStats[categoryName] || 0;
      
      // Calculate trend
      let trend = 0;
      let trendUp = true;
      if (prevCount > 0) {
        trend = ((count - prevCount) / prevCount) * 100;
        trendUp = trend >= 0;
        trend = Math.abs(trend);
      } else if (count > 0) {
        trend = 100; // New category
        trendUp = true;
      }

      const percentage = totalReports > 0 ? Math.round((count / totalReports) * 100) : 0;
      const config = categoryConfig[categoryName];

      return {
        name: categoryName,
        count,
        percentage,
        trend: trendUp ? `+${Math.round(trend)}%` : `-${Math.round(trend)}%`,
        trendUp,
        icon: config.icon,
        priority: config.priority,
        color: config.color
      };
    });

    // Sort by count descending
    categoryBreakdown.sort((a, b) => b.count - a.count);

    // Calculate summary statistics
    const summary = {
      totalReports,
      totalCategories: categoryBreakdown.filter(cat => cat.count > 0).length,
      highPriorityCategories: categoryBreakdown.filter(cat => 
        (cat.priority === "Critical" || cat.priority === "High") && cat.count > 0
      ).length,
      growingCategories: categoryBreakdown.filter(cat => cat.trendUp && cat.count > 0).length,
      period: `${daysAgo} days`
    };

    res.json({ 
      success: true, 
      data: categoryBreakdown,
      summary,
      period: daysAgo
    });
  } catch (err) {
    console.error("Category Breakdown Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /admin/analytics/priority-distribution
 * Get priority distribution based on upvotes
 */
const getPriorityDistribution = async (req, res) => {
  try {
    const { period = '30', department } = req.query;
    
    // Calculate date range
    const daysAgo = parseInt(period) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // Build match criteria
    const matchCriteria = {
      createdAt: { $gte: startDate },
      flagged: false
    };

    if (department && department !== 'all') {
      matchCriteria.assignedDepartment = department;
    }

    // Get all reports with upvotes and calculate priorities
    const reports = await Report.find(matchCriteria, 'upvotes priorityScore status createdAt lastPriorityUpdate assignedDepartment');
    
    // Calculate priority distribution
    const priorityStats = {
      LOW: { count: 0, percentage: 0, label: 'Low', color: 'green', upvotesRange: '0-10' },
      MEDIUM: { count: 0, percentage: 0, label: 'Medium', color: 'yellow', upvotesRange: '11-22' },
      HIGH: { count: 0, percentage: 0, label: 'High', color: 'orange', upvotesRange: '23-30' },
      URGENT: { count: 0, percentage: 0, label: 'Critical', color: 'red', upvotesRange: '30+' }
    };

    let totalReports = reports.length;
    let statusBreakdown = {};

    reports.forEach(report => {
      // Calculate current priority based on upvotes
      const priority = calculatePriority(report.upvotes || 0);
      priorityStats[priority.level].count++;

      // Track status breakdown
      if (!statusBreakdown[report.status]) {
        statusBreakdown[report.status] = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
      }
      statusBreakdown[report.status][priority.level]++;
    });

    // Calculate percentages
    if (totalReports > 0) {
      Object.keys(priorityStats).forEach(level => {
        priorityStats[level].percentage = Math.round((priorityStats[level].count / totalReports) * 100);
      });
    }

    // Get trending priorities (reports that recently got more upvotes)
    const trendingReports = await Report.find({
      ...matchCriteria,
      upvotes: { $gte: 5 }, // Only reports with some upvotes
      lastPriorityUpdate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Updated in last 24h
    }).sort({ upvotes: -1 }).limit(5).populate('assignedDepartment', 'name');

    // Summary statistics
    const summary = {
      totalReports,
      highPriorityReports: priorityStats.HIGH.count + priorityStats.URGENT.count,
      averageUpvotes: totalReports > 0 ? Math.round(reports.reduce((sum, r) => sum + (r.upvotes || 0), 0) / totalReports) : 0,
      period: `${period} days`,
      lastUpdated: new Date()
    };

    res.json({
      success: true,
      data: {
        distribution: priorityStats,
        statusBreakdown,
        trending: trendingReports.map(r => ({
          id: r._id,
          upvotes: r.upvotes,
          priority: calculatePriority(r.upvotes),
          status: r.status,
          department: r.assignedDepartment?.name || 'Unassigned',
          lastUpdated: r.lastPriorityUpdate
        })),
        summary
      }
    });
  } catch (err) {
    console.error("Priority Distribution Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * POST /admin/analytics/update-priorities
 * Bulk update priorities for all reports based on current upvotes
 */
const updateAllPriorities = async (req, res) => {
  try {
    const result = await bulkUpdatePriorities(Report);
    
    if (result.success) {
      res.json({
        success: true,
        message: "Priorities updated successfully",
        ...result
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to update priorities",
        error: result.error
      });
    }
  } catch (err) {
    console.error("Update Priorities Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /admin/analytics/team-members-count
 * Get count of team members with role 'member'
 */
const getTeamMembersCount = async (req, res) => {
  try {
    // Count department members with role 'member'
    const teamMembersCount = await Member.countDocuments({ 
      role: 'member',
      isActive: { $ne: false } // Only count active members
    });

    res.json({
      success: true,
      count: teamMembersCount
    });
  } catch (error) {
    console.error('Error getting team members count:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get team members count',
      error: error.message 
    });
  }
};

module.exports = {
  getDepartmentPerformance,
  getCategoryLocationTrends,
  exportReports,
  getTimeSeriesAnalytics,
  getCategoryBreakdown,
  getPriorityDistribution,
  updateAllPriorities,
  getTeamMembersCount
};

