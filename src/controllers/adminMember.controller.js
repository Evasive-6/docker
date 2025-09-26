const Member = require("../models/DepartmentMember");
const Department = require("../models/Department");
const mongoose = require("mongoose");

/**
 * List all members in a department
 */
exports.listMembers = async (req, res) => {
    try {
        const { departmentId } = req.params;
        
        const loggedInAdmin = req.admin;

        if (!mongoose.Types.ObjectId.isValid(departmentId)) {
            return res.status(400).json({ message: "Invalid department ID" });
        }

        if (loggedInAdmin.role !== "super_admin" && loggedInAdmin.departmentId.toString() !== req.params.departmentId) {
            return res.status(403).json({ message: "Cannot add members to other departments" });
        }

        const members = await Member.find({ departmentId, isActive: true }).select("-__v").lean();
        return res.json({ success: true, data: members });
    } catch (err) {
        console.error("listMembers error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Add a new member to a department
 */
exports.addMember = async (req, res) => {
    try {
        const loggedInAdmin = req.admin;
        const { departmentId } = req.params;
        const { name, email, phone, role, specialization } = req.body;

        if (!mongoose.Types.ObjectId.isValid(departmentId)) {
            return res.status(400).json({ message: "Invalid department ID" });
        }
        if (loggedInAdmin.role !== "super_admin" && loggedInAdmin.departmentId.toString() !== req.params.departmentId) {
            return res.status(403).json({ message: "Cannot add members to other departments" });
        }

        const department = await Department.findById(departmentId);
        if (!department || !department.isActive) {
            return res.status(404).json({ message: "Department not found or inactive" });
        }

        const existing = await Member.findOne({ email });
        if (existing) {
            return res.status(400).json({ message: "Member with this email already exists" });
        }

        const member = new Member({
            name,
            email,
            phone,
            departmentId,
            role: role || "member",
            specialization: specialization || []
        });

        await member.save();
        return res.status(201).json({ success: true, data: member });
    } catch (err) {
        console.error("addMember error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Update member details
 */exports.updateMember = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const loggedInAdmin = req.admin;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid member ID" });
        }

        const member = await Member.findById(id);
        if (!member || !member.isActive) {
            return res.status(404).json({ message: "Member not found or inactive" });
        }

        // Only super_admin or admin/head of the same department can update
        if (
            loggedInAdmin.role !== "super_admin" &&
            loggedInAdmin.departmentId.toString() !== member.departmentId.toString()
        ) {
            return res.status(403).json({ message: "Cannot update members of other departments" });
        }

        Object.assign(member, updates);
        await member.save();
        return res.json({ success: true, data: member });
    } catch (err) {
        console.error("updateMember error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Remove (deactivate) a member
 */
exports.removeMember = async (req, res) => {
    try {
        const { id } = req.params;
        const loggedInAdmin = req.admin;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid member ID" });
        }

        const member = await Member.findById(id);
        if (!member || !member.isActive) {
            return res.status(404).json({ message: "Member not found or already inactive" });
        }

        // Only super_admin or admin/head of the same department can remove
        if (
            loggedInAdmin.role !== "super_admin" &&
            loggedInAdmin.departmentId.toString() !== member.departmentId.toString()
        ) {
            return res.status(403).json({ message: "Cannot remove members of other departments" });
        }

        member.isActive = false;
        await member.save();
        return res.json({ success: true, message: "Member removed successfully" });
    } catch (err) {
        console.error("removeMember error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};