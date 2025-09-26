const Department = require('../models/Department');

// List all departments
exports.listDepartments = async (req, res) => {
    try {
        const departments = await Department.find().sort({ name: 1 });
        res.json({ success: true, data: departments });
    } catch (err) {
        console.error("List Departments Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Create a new department
exports.createDepartment = async (req, res) => {
    try {
        const { name, category, description, contactEmail, contactPhone, headOfDepartment } = req.body;
        const existing = await Department.findOne({ name });
        if (existing) return res.status(400).json({ success: false, message: "Department already exists" });

        const dept = new Department({ name, category, description, contactEmail, contactPhone, headOfDepartment });
        await dept.save();
        res.status(201).json({ success: true, data: dept });
    } catch (err) {
        console.error("Create Department Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Update department
exports.updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const updateFields = req.body;
        const dept = await Department.findByIdAndUpdate(id, updateFields, { new: true });
        if (!dept) return res.status(404).json({ success: false, message: "Department not found" });

        res.json({ success: true, data: dept });
    } catch (err) {
        console.error("Update Department Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Deactivate / Delete department
exports.deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const dept = await Department.findByIdAndUpdate(id, { isActive: false }, { new: true });
        if (!dept) return res.status(404).json({ success: false, message: "Department not found" });

        res.json({ success: true, data: dept });
    } catch (err) {
        console.error("Delete Department Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};