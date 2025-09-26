const express = require("express");
const router = express.Router();

const adminAuth = require("../middleware/adminAuth.middleware");
const permissions = require("../middleware/permissions.middleware");

const adminController = require("../controllers/admin.controller");
const adminReportController = require("../controllers/adminReport.controller");
const adminDepartmentController = require("../controllers/adminDepartment.controller");
const adminMemberController = require("../controllers/adminMember.controller");
const adminDashboardController=require('../controllers/adminDashboard.controller')
const adminActivityController = require('../controllers/adminActivity.controller');
const adminAnalyticsController = require("../controllers/adminAnalytics.controller");
const adminNotificationController = require("../controllers/adminNotification.controller");



router.post("/login", adminController.login);


// All routes require adminAuth
router.use(adminAuth);


router.post(
    "/admins",
    permissions(["super_admin"]), // Only super admin can create admins
    adminController.createAdmin
);

/** Admin Profile */
router.get("/profile", adminAuth, adminController.getProfile);
router.put("/profile", adminAuth, adminController.updateProfile);

/** Reports Listing & Filtering */
router.get("/reports", permissions(["view_reports"]), adminReportController.listReports);
router.get("/reports/by-department/:departmentId", permissions(["view_reports"]), adminReportController.getReportsByDepartment);
router.get("/reports/by-category/:category", permissions(["view_reports"]), adminReportController.getReportsByCategory);
router.get("/reports/unassigned", permissions(["view_reports"]), adminReportController.getUnassignedReports);
router.get("/reports/flagged", permissions(["view_reports"]), adminReportController.getFlaggedReports);
router.get("/reports/:reportId", permissions(["view_reports"]), adminReportController.getReportById);
router.patch("/reports/:reportId", permissions(["edit_reports"]), adminReportController.updateReport);

/** Department Management (4.1) */
router.get("/departments", permissions(["manage_departments"]), adminDepartmentController.listDepartments);
router.post("/departments", permissions(["manage_departments"]), adminDepartmentController.createDepartment);
router.patch("/departments/:departmentId", permissions(["manage_departments"]), adminDepartmentController.updateDepartment);
router.delete("/departments/:departmentId", permissions(["manage_departments"]), adminDepartmentController.deleteDepartment);

/** Member Management (4.2) */
router.get("/departments/:departmentId/members", permissions(["manage_assignments"]), adminMemberController.listMembers);
router.post("/departments/:departmentId/members", permissions(["manage_assignments"]), adminMemberController.addMember);
router.patch("/departments/members/:memberId", permissions(["manage_assignments"]), adminMemberController.updateMember);
router.delete("/departments/members/:memberId", permissions(["manage_assignments"]), adminMemberController.removeMember);

router.get(
    '/dashboard/stats',
    permissions(["view_reports", "view_analytics"]), // Only admins with analytics permission
    adminDashboardController.getDashboardStats
);

// Report Activity & Comments
router.get(
    '/reports/:id/history',
    permissions(["view_reports"]),
    adminActivityController.getReportHistory
);

router.get(
    '/activity/recent',
    permissions(["view_reports"]),
    adminActivityController.getRecentAdminActivity
);

router.post(
    '/reports/:id/comment',
    permissions(["edit_reports"]),
    adminActivityController.addReportComment
);


router.get("/notifications", permissions(["view_reports"]), adminNotificationController.getNotifications);
router.put("/notifications/:id/read", permissions(["view_reports"]), adminNotificationController.markAsRead);
router.put("/notifications/read-all", permissions(["view_reports"]), adminNotificationController.markAllAsRead);


router.get("/analytics/performance",
    permissions(["view_analytics"]),
    adminAnalyticsController.getDepartmentPerformance
);

router.get("/analytics/trends",
    permissions(["view_analytics"]),
    adminAnalyticsController.getCategoryLocationTrends
);

router.get("/analytics/timeseries",
    permissions(["view_analytics"]),
    adminAnalyticsController.getTimeSeriesAnalytics
);

router.get("/analytics/category-breakdown",
    permissions(["view_analytics"]),
    adminAnalyticsController.getCategoryBreakdown
);

router.get("/analytics/priority-distribution",
    permissions(["view_analytics"]),
    adminAnalyticsController.getPriorityDistribution
);

router.get("/analytics/team-members-count",
    permissions(["view_analytics"]),
    adminAnalyticsController.getTeamMembersCount
);

router.post("/analytics/update-priorities",
    permissions(["manage_reports"]), // Only users with report management can bulk update
    adminAnalyticsController.updateAllPriorities
);

router.get("/reports/export",
    permissions(["export_data"]),
    adminAnalyticsController.exportReports
);

module.exports = router;
