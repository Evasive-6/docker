require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Admin = require('../models/Admin'); // Update path if different

const MONGO_URI = process.env.MONGO_URI;

async function seedSuperAdmin() {
    try {
        await mongoose.connect(MONGO_URI);

        const existingAdmin = await Admin.findOne({ email: 'superadmin@gmail.com' });
        if (existingAdmin) {
            console.log('Super Admin already exists:', existingAdmin.email);
            process.exit(0);
        }

        const hashedPassword = await bcrypt.hash('sih2025', 10);

        const superAdmin = new Admin({
            email: 'superadmin@gmail.com',
            password: hashedPassword,
            role: 'super_admin',
            permissions: ["view_reports","edit_reports","delete_reports","manage_assignments","manage_departments","view_analytics","export_data","super_admin"],
            isActive: true,
            profile: {
                name: 'Super Admin',
                phone: '9558545249',
                designation: 'Administrator'
            }
        });

        await superAdmin.save();
        console.log('Super Admin created successfully:', superAdmin.email);
        process.exit(0);

    } catch (err) {
        console.error('Error seeding super admin:', err);
        process.exit(1);
    }
}

// seedSuperAdmin();

module.exports = seedSuperAdmin;