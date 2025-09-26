const Report = require("../models/Report");
const Department = require("../models/Department");
const Member = require("../models/DepartmentMember");
const mongoose = require("mongoose");
const { getDepartmentByCategory } = require("../utils/departmentRouting.util");

// Utility to parse pagination query params
function parsePagination(req) {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}

// Utility to build common filters
function buildFilters(req) {
    const filters = {};
    const { status, category, assignedTo, startDate, endDate, location } = req.query;

    if (status) filters.status = status;
    if (category) filters.finalCategory = category;
    if (assignedTo) filters.assignedDepartment = assignedTo;
    if (location) filters["location.address"] = { $regex: location, $options: "i" };
    if (startDate || endDate) {
        filters.createdAt = {};
        if (startDate) filters.createdAt.$gte = new Date(startDate);
        if (endDate) filters.createdAt.$lte = new Date(endDate);
    }

    return filters;
}

// --------------------
// 3.1 Report Listing & Filtering
// --------------------
exports.listReports = async (req, res) => {
    try {
        const { limit, skip } = parsePagination(req);
        const filters = buildFilters(req);

        // Regular admin sees only their department reports
        if (req.admin.role !== "super_admin" && req.admin.departmentId) {
            filters.assignedDepartment = req.admin.departmentId;
        }

        const reports = await Report.find(filters)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("userId", "phoneNumber")
            .populate("assignedDepartment")
            .populate("assignedMembers.memberId")
            .populate("resolvedBy");

        const total = await Report.countDocuments(filters);

        res.json({ total, page: Math.ceil(skip / limit) + 1, reports });
    } catch (err) {
        console.error("listReports error:", err);
        res.status(500).json({ error: "Server error" });
    }
};

// --------------------
// 3.2 Department-wise Report Views
// --------------------

// Reports for a specific department
exports.getReportsByDepartment = async (req, res) => {
    try {
        const { departmentId } = req.params;
        const { limit, skip } = parsePagination(req);

        // Restrict access for regular admins to their own department
        if (req.admin.role !== "super_admin" && req.admin.departmentId.toString() !== departmentId) {
            return res.status(403).json({ error: "Access denied" });
        }

        const filters = buildFilters(req);
        filters.assignedDepartment = departmentId;

        const reports = await Report.find(filters)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("userId", "phoneNumber")
            .populate("assignedMembers.memberId")
            .populate("resolvedBy");

        const total = await Report.countDocuments(filters);

        res.json({ total, page: Math.ceil(skip / limit) + 1, reports });
    } catch (err) {
        console.error("getReportsByDepartment error:", err);
        res.status(500).json({ error: "Server error" });
    }
};

// Reports for a specific category
exports.getReportsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const { limit, skip } = parsePagination(req);

        const filters = buildFilters(req);
        filters.finalCategory = category;

        // Restrict regular admins to their department reports only
        if (req.admin.role !== "super_admin" && req.admin.departmentId) {
            filters.assignedDepartment = req.admin.departmentId;
        }

        const reports = await Report.find(filters)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("userId", "phoneNumber")
            .populate("assignedDepartment")
            .populate("assignedMembers.memberId")
            .populate("resolvedBy");

        const total = await Report.countDocuments(filters);

        res.json({ total, page: Math.ceil(skip / limit) + 1, reports });
    } catch (err) {
        console.error("getReportsByCategory error:", err);
        res.status(500).json({ error: "Server error" });
    }
};

// Unassigned reports
exports.getUnassignedReports = async (req, res) => {
    try {
        const { limit, skip } = parsePagination(req);
        const filters = buildFilters(req);
        filters.assignedDepartment = null;

        const reports = await Report.find(filters)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("userId", "phoneNumber")
            .populate("assignedMembers.memberId")
            .populate("resolvedBy");

        const total = await Report.countDocuments(filters);

        res.json({ total, page: Math.ceil(skip / limit) + 1, reports });
    } catch (err) {
        console.error("getUnassignedReports error:", err);
        res.status(500).json({ error: "Server error" });
    }
};














// Flagged reports
exports.getFlaggedReports = async (req, res) => {
    try {
        const { limit, skip } = parsePagination(req);
        const filters = buildFilters(req);
        filters.flagged = true;

        const reports = await Report.find(filters)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("userId", "phoneNumber")
            .populate("assignedDepartment")
            .populate("assignedMembers.memberId")
            .populate("resolvedBy");

        const total = await Report.countDocuments(filters);

        res.json({ total, page: Math.ceil(skip / limit) + 1, reports });
    } catch (err) {
        console.error("getFlaggedReports error:", err);
        res.status(500).json({ error: "Server error" });
    }
};

// --------------------
// Get single report by ID
// --------------------
exports.getReportById = async (req, res) => {
    try {
        const { reportId } = req.params;

        // Validate MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(reportId)) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid report ID" 
            });
        }

        const report = await Report.findById(reportId)
            .populate("userId", "phoneNumber")
            .populate("assignedDepartment")
            .populate("assignedMembers.memberId")
            .populate("resolvedBy")
            .populate("categoryHistory.changedBy", "name email");

        if (!report) {
            return res.status(404).json({ 
                success: false, 
                message: "Report not found" 
            });
        }

        // Restrict access for regular admins to their department reports only
        if (
            req.admin.role !== "super_admin" && 
            report.assignedDepartment &&
            req.admin.departmentId.toString() !== report.assignedDepartment._id.toString()
        ) {
            return res.status(403).json({ 
                success: false, 
                message: "Access denied for this report" 
            });
        }

        res.json({ 
            success: true, 
            data: report 
        });
    } catch (err) {
        console.error("getReportById error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Server error" 
        });
    }
};



exports.updateReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const updates = req.body;
    const loggedInAdmin = req.admin;

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({ success: false, message: "Invalid report ID" });
    }

    let report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    // Restrict regular admins to their department’s reports
    if (
      loggedInAdmin.role !== "super_admin" &&
      report.assignedDepartment &&
      loggedInAdmin.departmentId.toString() !== report.assignedDepartment.toString()
    ) {
      return res.status(403).json({ success: false, message: "Access denied for this report" });
    }

    // --- Step 4: Handle Final Category Override ---
    if (updates.finalCategory && updates.finalCategory !== report.finalCategory) {
      const oldCategory = report.finalCategory || report.aiCategory || "unclassified";

      // Update finalCategory
      report.finalCategory = updates.finalCategory;

      // Find new department for updated category
      const newDeptId = await getDepartmentByCategory(updates.finalCategory);
      if (newDeptId && newDeptId.toString() !== report.assignedDepartment?.toString()) {
        report.assignedDepartment = newDeptId;
        console.log(`Department changed due to category change: ${updates.finalCategory} -> ${newDeptId}`);
      }

      // Push into categoryHistory
      report.categoryHistory.push({
        oldCategory,
        newCategory: updates.finalCategory,
        changedBy: loggedInAdmin._id,
        changedAt: new Date()
      });
    }

    // Handle status changes and track history
    if (updates.status && updates.status !== report.status) {
      const oldStatus = report.status;
      report.status = updates.status;
      
      // Add to status history
      report.statusHistory.push({
        status: updates.status,
        customMessage: updates.customStatusMessage || updates.publicStatusMessage || "",
        changedBy: loggedInAdmin._id,
        changedAt: new Date()
      });

      // Set resolved timestamp if status is resolved
      if (updates.status === "resolved") {
        report.resolvedAt = new Date();
        report.resolvedBy = loggedInAdmin._id;
      }

      console.log(`Status changed from ${oldStatus} to ${updates.status}`);
    }

    // Handle public status message
    if (updates.publicStatusMessage !== undefined) {
      report.publicStatusMessage = updates.publicStatusMessage;
    }

    // Handle custom status message
    if (updates.customStatusMessage !== undefined) {
      report.customStatusMessage = updates.customStatusMessage;
    }

    // Handle admin comments
    if (updates.adminComments && Array.isArray(updates.adminComments)) {
      updates.adminComments.forEach(comment => {
        report.adminComments.push({
          comment: comment.comment,
          addedBy: loggedInAdmin._id,
          addedAt: new Date(),
          isPublic: comment.isPublic || false
        });
      });
      console.log(`Added ${updates.adminComments.length} admin comments`);
    }

    // Handle assigned members
    if (updates.assignedMembers && Array.isArray(updates.assignedMembers)) {
      // Clear existing assignments and add new ones
      report.assignedMembers = [];
      updates.assignedMembers.forEach(member => {
        report.assignedMembers.push({
          memberId: member.memberId,
          assignedAt: new Date(),
          assignedBy: loggedInAdmin._id
        });
      });
    }

    // Handle department assignment directly (if not changed via category)
    if (updates.assignedDepartment && 
        updates.assignedDepartment.toString() !== report.assignedDepartment?.toString()) {
      report.assignedDepartment = updates.assignedDepartment;
      console.log(`Department manually assigned: ${updates.assignedDepartment}`);
    }

    // Apply other updates (except the ones we handled above)
    const excludedFields = [
      "finalCategory", "status", "adminComments", "assignedMembers", 
      "assignedDepartment", "publicStatusMessage", "customStatusMessage"
    ];
    
    Object.keys(updates).forEach((key) => {
      if (!excludedFields.includes(key)) {
        report[key] = updates[key];
      }
    });

    // Save the updated report
    await report.save();

    // Populate the response with referenced data
    const populatedReport = await Report.findById(reportId)
      .populate("userId", "phoneNumber")
      .populate("assignedDepartment", "name")
      .populate("assignedMembers.memberId", "name designation")
      .populate("statusHistory.changedBy", "name")
      .populate("adminComments.addedBy", "name");

    console.log("Report updated successfully:", reportId);

    return res.json({ 
      success: true, 
      data: populatedReport,
      message: "Report updated successfully"
    });
  } catch (err) {
    console.error("updateReport error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};