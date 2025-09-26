const User=require('../models/User')
const Admin=require('../models/Admin')
const Otp=require('../models/Otp')
const generateOtp=require('../utils/generateOtp')
const sendSms=require('../utils/sendSms')
const bcrypt = require('bcryptjs')
require('dotenv').config()


const {signToken}=require('../utils/token')

const requestOtp=async(req,res)=>{
    try {
        const {phoneNumber}=req.body;
        if (!phoneNumber) {
            return res.status(400).json({ message: "Phone number required" });
        }

        const otp=generateOtp();
        const expiresAt = Date.now() + 5 * 60 * 1000;

        // Save OTP to database
        await Otp.findOneAndUpdate({phoneNumber},{otp,expiresAt},{upsert:true,new:true})
        
        // Try to send SMS, but don't fail if Twilio is not configured
        try {
            await sendSms(phoneNumber,`Your OTP is ${otp}`)
            console.log(`📱 SMS sent to ${phoneNumber}: ${otp}`)
        } catch (smsError) {
            console.log(`⚠️ SMS sending failed, but OTP generated: ${otp}`);
            console.log(`📱 For testing, use OTP: ${otp}`);
        }

        res.json({
            success: true,
            message: "OTP sent successfully",
            // In development, include OTP in response for testing
            ...(process.env.NODE_ENV === 'development' && { otp })
        });

    } catch (error) {
        console.error("requestOtp error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to send OTP",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

const verifyOtp=async(req,res)=>{
    try{
    const {phoneNumber,otp}=req.body;
    const record=await Otp.findOne({phoneNumber});

    if(!record){
        return res.status(400).json({error:"Invalid or expired OTP"})
    }

    if (record.expiresAt < Date.now()) {
        return res.status(400).json({ message: "OTP expired" });
    }

    if (record.otp !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
    }


    let user=await User.findOne({phoneNumber})
    if(!user)user=await User.create({phoneNumber})
    
    const token=signToken({id:user._id,role:"user"}, "24h"); // Extended to 24 hours
    // console.log(token)

    await Otp.deleteOne({phoneNumber})

    return res.json({token,user})
}
    catch(err){
        // console.log(err)
        return res.status(500).json({message:err});
        
    }

}

/**
 * Unified login endpoint - handles both admin email/password and mobile OTP redirect
 */
const login = async (req, res) => {
    try {
        const { email, password, phoneNumber } = req.body;
        
        // If email and password provided, attempt admin login
        if (email && password) {
            const admin = await Admin.findOne({ email }).select('+password');
            
            if (!admin) {
                return res.status(401).json({ 
                    success: false, 
                    message: "Invalid credentials" 
                });
            }
            
            const isPasswordValid = await bcrypt.compare(password, admin.password);
            if (!isPasswordValid) {
                return res.status(401).json({ 
                    success: false, 
                    message: "Invalid credentials" 
                });
            }
            
            const token = signToken({ id: admin._id, role: "admin" }, "24h"); // Extended to 24 hours
            
            return res.json({
                success: true,
                token,
                user: {
                    _id: admin._id,
                    email: admin.email,
                    name: admin.name,
                    role: admin.role,
                    department: admin.department
                },
                userType: "admin"
            });
        }
        
        // If phone number provided, redirect to OTP flow
        if (phoneNumber) {
            return res.json({
                success: true,
                message: "Please use /auth/send-otp for mobile authentication",
                redirectTo: "/auth/send-otp",
                phoneNumber
            });
        }
        
        return res.status(400).json({
            success: false,
            message: "Please provide either email/password for admin login or phoneNumber for OTP login"
        });
        
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

/**
 * Get current user profile
 */
const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-__v');
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        
        return res.json({ 
            success: true, 
            user: {
                _id: user._id,
                phoneNumber: user.phoneNumber,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });
    } catch (err) {
        console.error("getUserProfile error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

module.exports = { requestOtp, verifyOtp, getUserProfile, login };