const { getAdminsByDepartment } = require("../utils/departmentRouting.util");

async function notifyDepartmentAdmins(deptId, reportId) {
    try {
        const admins = await getAdminsByDepartment(deptId);
        if (!admins || admins.length === 0) return;

        admins.forEach(admin => {
            // Example: console log notification
            console.log(`Notify Admin ${admin.name} (${admin.email}): New report assigned - ${reportId}`);
            
            // TODO: Replace with your actual notification system (email, push, in-app)
            // sendEmail(admin.email, `New report assigned: ${reportId}`, 'Check the report dashboard');
        });
    } catch (err) {
        console.error("Error notifying department admins:", err.message || err);
    }
}

module.exports = {
    notifyDepartmentAdmins
};