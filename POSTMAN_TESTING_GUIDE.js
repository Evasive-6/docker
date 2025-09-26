/**
 * 🧪 CivicSaathi API Testing Guide - Postman Collection Order
 * 
 * SETUP REQUIREMENTS:
 * 1. Set base URL: http://localhost:3000 (or your server URL)
 * 2. Create environment variables:
 *    - {{baseURL}} = http://localhost:3000
 *    - {{userToken}} = (will be set after user login)
 *    - {{adminToken}} = (will be set after admin login)
 *    - {{superAdminToken}} = (will be set after super admin login)
 */

// 📋 TESTING ORDER - LOGICAL FLOW

// 🔐 PHASE 1: AUTHENTICATION SETUP

// 1️⃣ API Health Check
const healthCheck = {
    method: "GET",
    url: "{{baseURL}}/",
    expected: "Civic Saathi Backend API running"
};

// 2️⃣ Super Admin Login (Setup Admin Accounts)
const superAdminLogin = {
    method: "POST",
    url: "{{baseURL}}/admin/login",
    headers: {
        "Content-Type": "application/json"
    },
    body: {
        "email": "superadmin@civic.gov",
        "password": "superadmin123"
    },
    saveResponse: "token → {{superAdminToken}}"
};

// 3️⃣ Create Department (Super Admin Only)
const createDepartment = {
    method: "POST",
    url: "{{baseURL}}/admin/departments",
    headers: {
        "Authorization": "Bearer {{superAdminToken}}",
        "Content-Type": "application/json"
    },
    body: {
        "name": "Public Works Department",
        "category": "infrastructure",
        "description": "Handles roads, drainage, streetlights",
        "contactEmail": "pwd@civic.gov",
        "contactPhone": "+1234567890",
        "headOfDepartment": "John Smith"
    }
};

// 4️⃣ Create Department Admin (Super Admin Only)
const createDepartmentAdmin = {
    method: "POST",
    url: "{{baseURL}}/admin/admins",
    headers: {
        "Authorization": "Bearer {{superAdminToken}}",
        "Content-Type": "application/json"
    },
    body: {
        "email": "pwd.admin@civic.gov",
        "password": "admin123",
        "permissions": ["view_reports", "edit_reports", "manage_assignments"],
        "departmentId": "DEPARTMENT_ID_FROM_STEP_3"
    }
};

// 5️⃣ Department Admin Login
const departmentAdminLogin = {
    method: "POST",
    url: "{{baseURL}}/admin/login",
    headers: {
        "Content-Type": "application/json"
    },
    body: {
        "email": "pwd.admin@civic.gov",
        "password": "admin123"
    },
    saveResponse: "token → {{adminToken}}"
};

// 📱 PHASE 2: MOBILE USER FLOW

// 6️⃣ Send OTP to Mobile
const sendOtp = {
    method: "POST",
    url: "{{baseURL}}/auth/send-otp",
    headers: {
        "Content-Type": "application/json"
    },
    body: {
        "phoneNumber": "+919876543210"
    }
};

// 7️⃣ Verify OTP & Get User Token
const verifyOtp = {
    method: "POST",
    url: "{{baseURL}}/auth/verify-otp",
    headers: {
        "Content-Type": "application/json"
    },
    body: {
        "phoneNumber": "+919876543210",
        "otp": "123456"
    },
    saveResponse: "token → {{userToken}}"
};

// 8️⃣ Get User Profile
const getUserProfile = {
    method: "GET",
    url: "{{baseURL}}/auth/me",
    headers: {
        "Authorization": "Bearer {{userToken}}"
    }
};

// 9️⃣ Get Presigned URL for File Upload
const getPresignedUrl = {
    method: "GET",
    url: "{{baseURL}}/api/reports/presigned-url?fileName=pothole.jpg&contentType=image/jpeg",
    headers: {
        "Authorization": "Bearer {{userToken}}"
    }
};

// 🔟 Create Civic Report
const createReport = {
    method: "POST",
    url: "{{baseURL}}/api/reports/",
    headers: {
        "Authorization": "Bearer {{userToken}}",
        "Content-Type": "application/json"
    },
    body: {
        "userId": "USER_ID_FROM_LOGIN",
        "description": "Large pothole on Main Street causing traffic issues",
        "location": {
            "type": "Point",
            "coordinates": [77.2090, 28.6139],
            "address": "Main Street, Connaught Place, New Delhi",
            "city": "New Delhi",
            "district": "Central Delhi",
            "zipcode": "110001"
        },
        "photos": ["https://s3.amazonaws.com/bucket/pothole1.jpg"],
        "userCategory": "Road Infrastructure",
        "suggestedSolution": "Fill the pothole with proper material and resurface"
    },
    saveResponse: "report._id → {{reportId}}"
};

// 🌐 PHASE 3: PUBLIC ACCESS (No Auth Required)

// 1️⃣1️⃣ Track Report Publicly
const trackReportPublic = {
    method: "GET",
    url: "{{baseURL}}/api/public/track/{{reportId}}"
};

// 1️⃣2️⃣ Get Report Timeline
const getReportTimeline = {
    method: "GET",
    url: "{{baseURL}}/api/public/track/{{reportId}}/timeline"
};

// 1️⃣3️⃣ Get Public Statistics
const getPublicStatistics = {
    method: "GET",
    url: "{{baseURL}}/api/public/statistics"
};

// 1️⃣4️⃣ Get Nearby Reports
const getNearbyReports = {
    method: "GET",
    url: "{{baseURL}}/api/public/reports/nearby?lat=28.6139&lng=77.2090&radius=5000&limit=10"
};

// 1️⃣5️⃣ Get Reports by Area
const getReportsByArea = {
    method: "GET",
    url: "{{baseURL}}/api/public/reports/area/110001?status=open&limit=10"
};

// 1️⃣6️⃣ Get Success Stories
const getSuccessStories = {
    method: "GET",
    url: "{{baseURL}}/api/public/success-stories?limit=5"
};

// 1️⃣7️⃣ Get Department Leaderboard
const getDepartmentLeaderboard = {
    method: "GET",
    url: "{{baseURL}}/api/public/departments/leaderboard"
};

// 👨‍💼 PHASE 4: DEPARTMENT ADMIN ACCESS

// 1️⃣8️⃣ Get Admin Profile
const getAdminProfile = {
    method: "GET",
    url: "{{baseURL}}/admin/profile",
    headers: {
        "Authorization": "Bearer {{adminToken}}"
    }
};

// 1️⃣9️⃣ Get Dashboard Stats (Department Filtered)
const getDashboardStats = {
    method: "GET",
    url: "{{baseURL}}/admin/dashboard/stats",
    headers: {
        "Authorization": "Bearer {{adminToken}}"
    }
};

// 2️⃣0️⃣ List Department Reports
const listDepartmentReports = {
    method: "GET",
    url: "{{baseURL}}/admin/reports?page=1&limit=10&status=open",
    headers: {
        "Authorization": "Bearer {{adminToken}}"
    }
};

// 2️⃣1️⃣ Get Specific Report Details
const getSpecificReport = {
    method: "GET",
    url: "{{baseURL}}/admin/reports/{{reportId}}",
    headers: {
        "Authorization": "Bearer {{adminToken}}"
    }
};

// 2️⃣2️⃣ Update Report Status
const updateReportStatus = {
    method: "PATCH",
    url: "{{baseURL}}/admin/reports/{{reportId}}",
    headers: {
        "Authorization": "Bearer {{adminToken}}",
        "Content-Type": "application/json"
    },
    body: {
        "status": "in-progress",
        "publicStatusMessage": "Work has been assigned to field team",
        "finalCategory": "Road Maintenance"
    }
};

// 2️⃣3️⃣ Add Comment to Report
const addReportComment = {
    method: "POST",
    url: "{{baseURL}}/admin/reports/{{reportId}}/comment",
    headers: {
        "Authorization": "Bearer {{adminToken}}",
        "Content-Type": "application/json"
    },
    body: {
        "comment": "Field team dispatched. Expected completion in 3 days.",
        "isPublic": true
    }
};

// 2️⃣4️⃣ Get Report History
const getReportHistory = {
    method: "GET",
    url: "{{baseURL}}/admin/reports/{{reportId}}/history",
    headers: {
        "Authorization": "Bearer {{adminToken}}"
    }
};

// 👥 PHASE 5: TEAM MANAGEMENT (Department Admin)

// 2️⃣5️⃣ List Department Members
const listDepartmentMembers = {
    method: "GET",
    url: "{{baseURL}}/admin/departments/DEPARTMENT_ID/members",
    headers: {
        "Authorization": "Bearer {{adminToken}}"
    }
};

// 2️⃣6️⃣ Add New Member
const addNewMember = {
    method: "POST",
    url: "{{baseURL}}/admin/departments/DEPARTMENT_ID/members",
    headers: {
        "Authorization": "Bearer {{adminToken}}",
        "Content-Type": "application/json"
    },
    body: {
        "name": "Rajesh Kumar",
        "email": "rajesh.kumar@pwd.gov",
        "phone": "+919876543211",
        "role": "field_engineer",
        "specialization": ["road_repair", "drainage"]
    }
};

// 2️⃣7️⃣ Update Member Details
const updateMemberDetails = {
    method: "PATCH",
    url: "{{baseURL}}/admin/departments/members/MEMBER_ID",
    headers: {
        "Authorization": "Bearer {{adminToken}}",
        "Content-Type": "application/json"
    },
    body: {
        "phone": "+919876543212",
        "specialization": ["road_repair", "drainage", "streetlights"]
    }
};

// 🔔 PHASE 6: NOTIFICATION SYSTEM

// 2️⃣8️⃣ Get Unread Notifications Count
const getUnreadCount = {
    method: "GET",
    url: "{{baseURL}}/api/notifications/unread-count",
    headers: {
        "Authorization": "Bearer {{adminToken}}"
    }
};

// 2️⃣9️⃣ List All Notifications
const listAllNotifications = {
    method: "GET",
    url: "{{baseURL}}/api/notifications/?page=1&limit=20",
    headers: {
        "Authorization": "Bearer {{adminToken}}"
    }
};

// 3️⃣0️⃣ Mark Notification as Read
const markNotificationRead = {
    method: "PATCH",
    url: "{{baseURL}}/api/notifications/NOTIFICATION_ID/read",
    headers: {
        "Authorization": "Bearer {{adminToken}}"
    }
};

// 3️⃣1️⃣ Get Notification Statistics
const getNotificationStats = {
    method: "GET",
    url: "{{baseURL}}/api/notifications/stats/summary",
    headers: {
        "Authorization": "Bearer {{adminToken}}"
    }
};

// 🔱 PHASE 7: SUPER ADMIN EXCLUSIVE ACCESS

// 3️⃣2️⃣ List All Departments
const listAllDepartments = {
    method: "GET",
    url: "{{baseURL}}/admin/departments",
    headers: {
        "Authorization": "Bearer {{superAdminToken}}"
    }
};

// 3️⃣3️⃣ Get All Reports (System-wide)
const getAllReports = {
    method: "GET",
    url: "{{baseURL}}/admin/reports",
    headers: {
        "Authorization": "Bearer {{superAdminToken}}"
    }
};

// 3️⃣4️⃣ Get Unassigned Reports
const getUnassignedReports = {
    method: "GET",
    url: "{{baseURL}}/admin/reports/unassigned",
    headers: {
        "Authorization": "Bearer {{superAdminToken}}"
    }
};

// 3️⃣5️⃣ Get Reports by Category
const getReportsByCategory = {
    method: "GET",
    url: "{{baseURL}}/admin/reports/by-category/Road Infrastructure",
    headers: {
        "Authorization": "Bearer {{superAdminToken}}"
    }
};

// 3️⃣6️⃣ Get Analytics - Department Performance
const getDepartmentPerformance = {
    method: "GET",
    url: "{{baseURL}}/admin/analytics/performance",
    headers: {
        "Authorization": "Bearer {{superAdminToken}}"
    }
};

// 3️⃣7️⃣ Get Analytics - Trends
const getAnalyticsTrends = {
    method: "GET",
    url: "{{baseURL}}/admin/analytics/trends?startDate=2024-01-01&endDate=2024-12-31",
    headers: {
        "Authorization": "Bearer {{superAdminToken}}"
    }
};

// 3️⃣8️⃣ Export Reports to CSV
const exportReportsCSV = {
    method: "GET",
    url: "{{baseURL}}/admin/reports/export?status=resolved&startDate=2024-01-01&endDate=2024-12-31",
    headers: {
        "Authorization": "Bearer {{superAdminToken}}"
    }
};

// ⚙️ PHASE 8: QUEUE MANAGEMENT (Super Admin)

// 3️⃣9️⃣ Get Queue Status
const getQueueStatus = {
    method: "GET",
    url: "{{baseURL}}/admin/queue/status",
    headers: {
        "Authorization": "Bearer {{superAdminToken}}"
    }
};

// 4️⃣0️⃣ Process Report Manually
const processReportManually = {
    method: "POST",
    url: "{{baseURL}}/admin/queue/process-report",
    headers: {
        "Authorization": "Bearer {{superAdminToken}}",
        "Content-Type": "application/json"
    },
    body: {
        "reportId": "{{reportId}}"
    }
};

// 4️⃣1️⃣ Retry Failed Jobs
const retryFailedJobs = {
    method: "POST",
    url: "{{baseURL}}/admin/queue/retry-failed",
    headers: {
        "Authorization": "Bearer {{superAdminToken}}"
    }
};

// 🔒 PHASE 9: AUTHORIZATION TESTING

// 4️⃣2️⃣ Test Unauthorized Access (Should Fail)
const testUnauthorizedAccess = {
    method: "GET",
    url: "{{baseURL}}/admin/reports",
    expected: "401 Unauthorized"
};

// 4️⃣3️⃣ Test Department Admin accessing Other Department (Should Fail)
const testCrossDepartmentAccess = {
    method: "GET",
    url: "{{baseURL}}/admin/reports/by-department/OTHER_DEPARTMENT_ID",
    headers: {
        "Authorization": "Bearer {{adminToken}}"
    },
    expected: "403 Forbidden"
};

// 4️⃣4️⃣ Test Regular Admin Creating Department (Should Fail)
const testUnauthorizedDepartmentCreation = {
    method: "POST",
    url: "{{baseURL}}/admin/departments",
    headers: {
        "Authorization": "Bearer {{adminToken}}",
        "Content-Type": "application/json"
    },
    body: {
        "name": "Test Department",
        "category": "test"
    },
    expected: "403 Forbidden"
};

// 4️⃣5️⃣ Test User Token on Admin Route (Should Fail)
const testUserTokenOnAdminRoute = {
    method: "GET",
    url: "{{baseURL}}/admin/dashboard/stats",
    headers: {
        "Authorization": "Bearer {{userToken}}"
    },
    expected: "401 Unauthorized"
};

// 📄 PHASE 10: ADDITIONAL UTILITY ENDPOINTS

// 4️⃣6️⃣ Get Multiple File Presigned URLs
const getMultiplePresignedUrls = {
    method: "POST",
    url: "{{baseURL}}/api/media/presign",
    headers: {
        "Authorization": "Bearer {{userToken}}",
        "Content-Type": "application/json"
    },
    body: {
        "files": [
            {
                "name": "report_photo1.jpg",
                "contentType": "image/jpeg"
            },
            {
                "name": "report_audio.mp3",
                "contentType": "audio/mpeg"
            }
        ],
        "prefix": "reports/user123"
    }
};

// 4️⃣7️⃣ Get User's All Reports
const getUserAllReports = {
    method: "GET",
    url: "{{baseURL}}/api/reports/user/USER_ID",
    headers: {
        "Authorization": "Bearer {{userToken}}"
    }
};

// 4️⃣8️⃣ Get Recent Admin Activity
const getRecentAdminActivity = {
    method: "GET",
    url: "{{baseURL}}/admin/activity/recent?limit=10",
    headers: {
        "Authorization": "Bearer {{adminToken}}"
    }
};

// 🎯 TESTING CHECKLIST

const testingChecklist = {
    authenticationTesting: [
        "Valid logins work",
        "Invalid credentials rejected",
        "Tokens expire appropriately",
        "Role-based access enforced"
    ],
    authorizationTesting: [
        "Super admin can access everything",
        "Department admin restricted to their department",
        "Regular users can only access public + their own data",
        "Unauthorized requests properly rejected"
    ],
    functionalityTesting: [
        "Reports can be created and updated",
        "File uploads work with presigned URLs",
        "Notifications system functions",
        "Analytics and dashboard data accurate",
        "Queue management operational"
    ],
    errorHandling: [
        "Invalid IDs return 404",
        "Missing required fields return 400",
        "Server errors return 500 with proper messages"
    ]
};

// 📝 SAMPLE POSTMAN ENVIRONMENT VARIABLES
const postmanEnvironmentVariables = {
    "baseURL": "http://localhost:3000",
    "userToken": "",
    "adminToken": "", 
    "superAdminToken": "",
    "reportId": "",
    "departmentId": "",
    "memberId": "",
    "notificationId": ""
};

/**
 * TESTING SEQUENCE SUMMARY:
 * 
 * This testing sequence ensures comprehensive coverage of all endpoints, 
 * proper authentication/authorization verification, and validates the 
 * complete user journey from report creation to resolution tracking.
 * 
 * Total Endpoints Tested: 48
 * 
 * Key Testing Areas:
 * 1. Authentication & Authorization
 * 2. Report Creation & Management
 * 3. Admin Dashboard & Analytics
 * 4. Team Management
 * 5. Notification System
 * 6. Queue Management
 * 7. Public Transparency Features
 * 8. File Upload & Media Management
 * 9. Cross-role Permission Testing
 * 10. Error Handling Validation
 */

module.exports = {
    healthCheck,
    superAdminLogin,
    createDepartment,
    createDepartmentAdmin,
    departmentAdminLogin,
    sendOtp,
    verifyOtp,
    getUserProfile,
    getPresignedUrl,
    createReport,
    trackReportPublic,
    getReportTimeline,
    getPublicStatistics,
    getNearbyReports,
    getReportsByArea,
    getSuccessStories,
    getDepartmentLeaderboard,
    getAdminProfile,
    getDashboardStats,
    listDepartmentReports,
    getSpecificReport,
    updateReportStatus,
    addReportComment,
    getReportHistory,
    listDepartmentMembers,
    addNewMember,
    updateMemberDetails,
    getUnreadCount,
    listAllNotifications,
    markNotificationRead,
    getNotificationStats,
    listAllDepartments,
    getAllReports,
    getUnassignedReports,
    getReportsByCategory,
    getDepartmentPerformance,
    getAnalyticsTrends,
    exportReportsCSV,
    getQueueStatus,
    processReportManually,
    retryFailedJobs,
    testUnauthorizedAccess,
    testCrossDepartmentAccess,
    testUnauthorizedDepartmentCreation,
    testUserTokenOnAdminRoute,
    getMultiplePresignedUrls,
    getUserAllReports,
    getRecentAdminActivity,
    testingChecklist,
    postmanEnvironmentVariables
};