const Admin=require('../models/Admin')
const Department=require('../models/Department')

const bcrypt=require('bcryptjs');
const { signToken } = require('../utils/token');

const login=async(req,res)=>{

    try {
        const { email, password } = req.body;
        const admin = await Admin.findOne({ email, isActive: true }).populate('departmentId', 'name category');

        if (!admin) return res.status(401).json({ message: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

        // Generate token
        const token = signToken({ adminId: admin._id, role: admin.role }, "12h");

        // Update last login
        admin.lastLoginAt = new Date();
        await admin.save();

        res.json({
            token,
            admin: {
                id: admin._id,
                email: admin.email,
                role: admin.role,
                permissions: admin.permissions,
                department: admin.departmentId
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }

}


const createAdmin=async(req,res)=>{
        try {
        const { email, password, permissions = [], departmentId } = req.body;

        // Check required fields
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        // Check if admin with same email already exists
        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({ message: "Admin with this email already exists" });
        }

        // Validate department
        if (departmentId) {
            const dept = await Department.findById(departmentId);
            if (!dept) {
                return res.status(400).json({ message: "Invalid department ID" });
            }
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new Admin
        const newAdmin = new Admin({
            email,
            password: hashedPassword,
            role: "admin",
            permissions,
            departmentId: departmentId || null,
            isActive: true
        });

        await newAdmin.save();

        return res.status(201).json({
            message: "Admin created successfully",
            admin: {
                id: newAdmin._id,
                email: newAdmin.email,
                role: newAdmin.role,
                permissions: newAdmin.permissions,
                departmentId: newAdmin.departmentId
            }
        });
    } catch (err) {
        console.error("Create Admin Error:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
}










const getProfile=async(req,res)=>{

    try {
        const admin = await Admin.findById(req.admin._id).populate('departmentId', 'name category');
        res.json({
            id: admin._id,
            email: admin.email,
            role: admin.role,
            permissions: admin.permissions,
            department: admin.departmentId,
            profile: admin.profile
        });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }

}


const updateProfile=async(req,res)=>{

    try {
        const { name, phone, designation, password } = req.body;
        const admin = await Admin.findById(req.admin._id);

        if (name) admin.profile.name = name;
        if (phone) admin.profile.phone = phone;
        if (designation) admin.profile.designation = designation;

        if (password) {
            const salt = await bcrypt.genSalt(10);
            admin.password = await bcrypt.hash(password, salt);
        }

        await admin.save();

        res.json({ message: "Profile updated successfully", profile: admin.profile });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }

}



module.exports={login,getProfile,updateProfile,createAdmin}