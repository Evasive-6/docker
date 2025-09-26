const Department = require("../models/Department");
const Admin = require("../models/Admin");

/**
 * Get Department _id by category name
 * @param {string} categoryName
 * @returns {ObjectId|null} Department _id or null if not found
 */
async function getDepartmentByCategory(categoryName) {
    if (!categoryName) return null;

    const dept = await Department.findOne({ name: categoryName });
    return dept ? dept._id : null;
}

/**
 * Get all active admins for a department
 * @param {ObjectId} deptId
 * @returns {Array} Array of Admin documents
 */
async function getAdminsByDepartment(deptId) {
    if (!deptId) return [];
    const admins = await Admin.find({ departmentId: deptId, isActive: true });
    return admins;
}

/**
 * Notify all department admins about a new report
 * @param {ObjectId} deptId
 * @param {ObjectId|string} reportId
 */
async function notifyDepartmentAdmins(deptId, reportId) {
    try {
        const admins = await getAdminsByDepartment(deptId);
        if (!admins || admins.length === 0) return;

        admins.forEach(admin => {
            // Example: console log notification (safe for now)
            console.log(`Notify Admin ${admin.name} (${admin.email}): New report assigned - ${reportId}`);
            
            // TODO: Integrate your actual notification system here
            // e.g., email, push notification, in-app alert
            // sendEmail(admin.email, `New report assigned: ${reportId}`, 'Check the report dashboard');
        });
    } catch (err) {
        console.error("Error notifying department admins:", err.message || err);
    }
}

module.exports = {
    getDepartmentByCategory,
    getAdminsByDepartment,
    notifyDepartmentAdmins
};