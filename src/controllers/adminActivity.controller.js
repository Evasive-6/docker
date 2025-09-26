const Report = require('../models/Report');
const Admin = require('../models/Admin');

/**
 * GET /admin/reports/:id/history
 * Return full activity history of a specific report
 */
async function getReportHistory(req, res) {
  try {
    const { id } = req.params;

    const report = await Report.findById(id)
      .populate("statusHistory.changedBy", "profile.name email")
      .populate("categoryHistory.changedBy", "profile.name email")
      .populate("adminComments.addedBy", "profile.name email")
      .lean();

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.json({
      statusHistory: report.statusHistory || [],
      categoryHistory: report.categoryHistory || [],
      adminComments: report.adminComments || []
    });

  } catch (err) {
    console.error("Get Report History Error:", err);
    res.status(500).json({ message: "Failed to fetch report history" });
  }
}

/**
 * GET /admin/activity/recent
 * Return recent admin actions across reports
 */
async function getRecentAdminActivity(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Aggregate recent actions: status change, category change, comment added
    const recentStatusChanges = await Report.aggregate([
      { $unwind: "$statusHistory" },
      { $sort: { "statusHistory.changedAt": -1 } },
      { $limit: limit },
      {
        $project: {
          reportId: "$_id",
          action: { $concat: ["Status changed to ", "$statusHistory.status"] },
          changedBy: "$statusHistory.changedBy",
          changedAt: "$statusHistory.changedAt"
        }
      }
    ]);

    const recentCategoryChanges = await Report.aggregate([
      { $unwind: "$categoryHistory" },
      { $sort: { "categoryHistory.changedAt": -1 } },
      { $limit: limit },
      {
        $project: {
          reportId: "$_id",
          action: { $concat: ["Category changed from ", "$categoryHistory.oldCategory", " to ", "$categoryHistory.newCategory"] },
          changedBy: "$categoryHistory.changedBy",
          changedAt: "$categoryHistory.changedAt"
        }
      }
    ]);

    const recentComments = await Report.aggregate([
      { $unwind: "$adminComments" },
      { $sort: { "adminComments.addedAt": -1 } },
      { $limit: limit },
      {
        $project: {
          reportId: "$_id",
          action: { $concat: ["Comment added: ", "$adminComments.comment"] },
          addedBy: "$adminComments.addedBy",
          addedAt: "$adminComments.addedAt"
        }
      }
    ]);

    // Combine all actions and sort by date descending
    let combinedActions = [
      ...recentStatusChanges.map(a => ({ ...a, type: "status" })),
      ...recentCategoryChanges.map(a => ({ ...a, type: "category" })),
      ...recentComments.map(a => ({ ...a, type: "comment" }))
    ];

    combinedActions.sort((a, b) => new Date(b.changedAt || b.addedAt) - new Date(a.changedAt || a.addedAt));

    res.json(combinedActions.slice(0, limit));

  } catch (err) {
    console.error("Get Recent Admin Activity Error:", err);
    res.status(500).json({ message: "Failed to fetch recent admin activity" });
  }
}

/**
 * POST /admin/reports/:id/comment
 * Add a comment to a report
 */
async function addReportComment(req, res) {
  try {
    const { id } = req.params;
    const { comment, isPublic = false } = req.body;
    const adminId = req.admin._id; // From adminAuth middleware

    const report = await Report.findById(id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.adminComments.push({
      comment,
      addedBy: adminId,
      isPublic
    });

    await report.save();

    res.json({ message: "Comment added successfully", adminComments: report.adminComments });

  } catch (err) {
    console.error("Add Report Comment Error:", err);
    res.status(500).json({ message: "Failed to add comment" });
  }
}

module.exports = {
  getReportHistory,
  getRecentAdminActivity,
  addReportComment
};
